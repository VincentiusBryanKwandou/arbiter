"""Paper trading loop (FASE 5).

Loop live: harga REAL dari Polymarket, eksekusi SIMULASI (uang palsu).
Identik dengan live loop kecuali broker-nya. Jalankan minimal 14 hari (lihat
settings.paper.min_run_days) sebelum hasilnya dianggap valid.

    python -m paper.loop --cycles 5 --interval 60     # 5 siklus, jeda 60 detik
    python -m paper.loop --once                        # satu siklus

TIDAK ADA UANG NYATA. Aman dijalankan kapan saja.
"""

from __future__ import annotations

import argparse
import time

import structlog

from core.config import get_config
from core.data.clob_client import PolymarketReadClient
from core.edge.scanner import find_opportunities
from core.execution.sim import SimulatedBroker
from core.risk.limits import RiskManager
from paper.journal import TradeJournal

log = structlog.get_logger()


def run_cycle(broker: SimulatedBroker, risk: RiskManager, journal: TradeJournal, cfg) -> int:
    """Satu siklus SCAN->DETECT->VALIDATE->SIZE->FILL(paper). Return jumlah trade."""
    cost = float(cfg.strategy["backtest"]["cost_model"]["gas_usd_per_tx"])
    n = 0
    with PolymarketReadClient() as client:
        opps = find_opportunities(
            client, limit=300, max_markets=80,
            min_edge=float(cfg.edge.get("min_edge_threshold", 0.05)),
            min_notional=float(cfg.risk.get("min_orderbook_depth_usd", 50.0)),
        )
    for market_id, desc, opp in opps:
        sizing = risk.size_arbitrage(opp, market_id)
        if not sizing.approved:
            log.info("skipped", desc=desc, reasons=sizing.reasons)
            continue
        res = broker.place_arb(opp, market_id, sizing.sets, cost_per_tx=cost)
        risk.register_open(market_id, sizing.notional_usd)
        risk.register_close(market_id, res.locked_profit)
        journal.record(desc, res)
        log.info("paper_fill", desc=desc, profit=round(res.locked_profit, 4),
                 sets=res.filled_sets)
        n += 1
    return n


def main() -> None:
    ap = argparse.ArgumentParser(description="atlas-poly PAPER trading loop (no real money)")
    ap.add_argument("--cycles", type=int, default=1)
    ap.add_argument("--interval", type=int, default=60, help="jeda antar siklus (detik)")
    ap.add_argument("--once", action="store_true")
    args = ap.parse_args()

    cfg = get_config()
    start_cash = float(cfg.strategy["paper"]["starting_balance_usd"])
    broker = SimulatedBroker(starting_cash=start_cash)
    risk = RiskManager(cfg.risk, bankroll_usd=start_cash)
    journal = TradeJournal()

    cycles = 1 if args.once else args.cycles
    print(f"[PAPER] mode={cfg.mode.value}  start_cash=${start_cash}  cycles={cycles}")
    total = 0
    for i in range(cycles):
        n = run_cycle(broker, risk, journal, cfg)
        total += n
        print(f"  siklus {i+1}/{cycles}: {n} trade | equity=${broker.balance():.2f} "
              f"| journal_pnl=${journal.total_pnl():.2f}")
        if i < cycles - 1:
            time.sleep(args.interval)
    print(f"[PAPER] selesai. total trade={total} | realized=${broker.realized_pnl:.2f}")


if __name__ == "__main__":
    main()
