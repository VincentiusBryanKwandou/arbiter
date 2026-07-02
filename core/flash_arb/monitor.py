"""Flash arb monitor — continuous scan loop.

Scans all configured token pairs, finds arb opportunities across Uniswap V3
fee tiers and Aerodrome, executes profitable ones via flash loan.

Reports results to the Arbiter dashboard via Neon DB state file.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from core.flash_arb import config
from core.flash_arb.calculator import ArbOpportunity, check_arb, estimate_gas_cost_wei
from core.flash_arb.executor import FlashArbExecutor
from core.flash_arb.price_feed import PriceFeed

log = logging.getLogger(__name__)

STATE_PATH = Path(__file__).resolve().parents[2] / "storage" / "flash_arb_state.json"


@dataclass
class ScanResult:
    ts: str
    pairs_scanned: int
    opportunities: list[dict]
    executions: list[dict]
    best_edge_pct: float
    total_profit_usd: float
    errors: int


class FlashArbMonitor:
    def __init__(self) -> None:
        self._feed     = PriceFeed()
        self._executor = FlashArbExecutor()
        self._w3       = self._feed._w3
        self._running  = False
        self._results: list[ScanResult] = []

    async def _scan_pair(
        self,
        token_in: str,
        token_out: str,
        borrow_amount: int,
        gas_price: int,
        label: str,
    ) -> list[ArbOpportunity]:
        """Scan one pair — find best buy + sell quotes and check arb."""
        try:
            buy_quotes  = await self._feed.get_all_quotes(token_in, token_out, borrow_amount)
            if not buy_quotes:
                return []

            best_buy = buy_quotes[0]

            # Sell quotes: use the amount_out from the best buy as input
            sell_quotes = await self._feed.get_all_quotes(
                token_out, token_in, best_buy.amount_out
            )
            if not sell_quotes:
                return []

            opps = []
            for sell_q in sell_quotes:
                # Skip same DEX + same fee (trivial, no real arb)
                if sell_q.dex == best_buy.dex:
                    continue
                opp = check_arb(
                    token_in, token_out, borrow_amount,
                    best_buy, sell_q,
                    gas_price,
                    token_in_decimals=6 if "USDC" in label or "DAI" in label else 18,
                )
                if opp:
                    opp.label = f"{label} | {opp.label}"
                    opps.append(opp)

            return opps
        except Exception as e:
            log.error("Scan error for %s: %s", label, e)
            return []

    async def scan_once(self) -> ScanResult:
        ts         = datetime.now(timezone.utc).isoformat()
        errors     = 0
        all_opps:  list[ArbOpportunity] = []
        executions: list[dict]           = []

        try:
            gas_price = await estimate_gas_cost_wei(self._w3)
        except Exception:
            gas_price = 5_000_000  # 0.005 gwei fallback

        tasks = [
            self._scan_pair(t_in, t_out, amount, gas_price, label)
            for t_in, t_out, amount, label in config.SCAN_PAIRS
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for res in results:
            if isinstance(res, Exception):
                errors += 1
            else:
                all_opps.extend(res)

        # Sort by net profit descending
        all_opps.sort(key=lambda o: o.net_profit_usd, reverse=True)

        # Execute best opportunity if it exists
        for opp in all_opps[:1]:
            tx_hash = await self._executor.execute(opp)
            executions.append({
                "ts":             ts,
                "label":          opp.label,
                "borrow_amount":  opp.borrow_amount,
                "net_profit_usd": opp.net_profit_usd,
                "edge_pct":       opp.edge_pct,
                "tx_hash":        tx_hash or "none",
                "dry_run":        tx_hash == "dry_run",
            })

        best_edge = max((o.edge_pct for o in all_opps), default=0.0)
        total_profit = sum(o.net_profit_usd for o in all_opps)

        opp_dicts = [
            {
                "label":          o.label,
                "token_in":       o.token_in,
                "token_out":      o.token_out,
                "borrow_amount":  o.borrow_amount,
                "buy_dex":        o.buy_quote.dex,
                "sell_dex":       o.sell_quote.dex,
                "net_profit_usd": round(o.net_profit_usd, 4),
                "edge_pct":       round(o.edge_pct * 100, 4),
                "flash_fee":      o.flash_fee,
            }
            for o in all_opps
        ]

        result = ScanResult(
            ts=ts,
            pairs_scanned=len(config.SCAN_PAIRS),
            opportunities=opp_dicts,
            executions=executions,
            best_edge_pct=round(best_edge * 100, 4),
            total_profit_usd=round(total_profit, 4),
            errors=errors,
        )

        self._persist(result)
        self._log_result(result)
        return result

    def _persist(self, result: ScanResult) -> None:
        """Write state to JSON for dashboard to read."""
        try:
            STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
            STATE_PATH.write_text(
                json.dumps({
                    "last_scan":        result.ts,
                    "pairs_scanned":    result.pairs_scanned,
                    "opportunities":    result.opportunities,
                    "executions":       result.executions,
                    "best_edge_pct":    result.best_edge_pct,
                    "total_profit_usd": result.total_profit_usd,
                    "errors":           result.errors,
                }, indent=2),
                encoding="utf-8",
            )
        except Exception as e:
            log.warning("Failed to persist flash arb state: %s", e)

    def _log_result(self, r: ScanResult) -> None:
        if r.opportunities:
            log.info(
                "⚡ %d arb(s) found | best edge=%.4f%% | total est profit=$%.4f",
                len(r.opportunities), r.best_edge_pct, r.total_profit_usd,
            )
            for o in r.opportunities[:3]:
                log.info("  → %s | net=$%.4f | edge=%.4f%%", o["label"], o["net_profit_usd"], o["edge_pct"])
        else:
            log.info("⚡ No flash arb this cycle (pairs=%d, errors=%d)", r.pairs_scanned, r.errors)

    async def run(self) -> None:
        """Main loop — scan every SCAN_INTERVAL_SEC seconds."""
        self._running = True
        log.info("Flash Arb Monitor started | interval=%ds | dry_run=%s",
                 config.SCAN_INTERVAL_SEC, "ON" if self._executor._pk == "0x" else "OFF")
        while self._running:
            try:
                await self.scan_once()
            except Exception as e:
                log.exception("Unexpected scan error: %s", e)
            await asyncio.sleep(config.SCAN_INTERVAL_SEC)

    def stop(self) -> None:
        self._running = False
