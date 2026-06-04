"""Scanner integrasi (FASE 1+2+3, read-only).

Menjalankan rantai loop SCAN -> DETECT -> VALIDATE -> SIZE pada data LIVE,
TANPA FILL (tidak ada order, tidak ada uang). Ini alat observasi untuk
membuktikan hipotesis edge: berapa sering arbitrage politik benar-benar muncul?

    python -m core.edge.scanner --limit 300 --max-markets 80

Output: daftar peluang yang LOLOS semua filter + sizing yang DISETUJUI risk
manager (pakai modal paper dari settings.yaml). Tidak menyimpan, tidak trade.
"""

from __future__ import annotations

import argparse
from collections import defaultdict

import structlog

from core.config import get_config
from core.data.clob_client import PolymarketReadClient
from core.data.models import Market, OrderBook
from core.edge.arbitrage import (
    ArbOpportunity,
    detect_binary_dutch_book,
    detect_mutually_exclusive,
)
from core.edge.signals import validate_opportunity
from core.risk.limits import RiskManager

log = structlog.get_logger()


def _yes_token(m: Market) -> str | None:
    for t in m.tokens:
        if t.outcome.strip().lower() in ("yes", "ya"):
            return t.token_id
    return m.tokens[0].token_id if m.tokens else None


def find_opportunities(
    client: PolymarketReadClient, *, limit: int = 300, max_markets: int = 80,
    min_edge: float = 0.05, min_notional: float = 50.0,
) -> list[tuple[str, str, ArbOpportunity]]:
    """SCAN + DETECT + VALIDATE pada data live. Kembalikan (market_id, desc, opp)
    untuk peluang yang LOLOS validasi. Tidak melakukan sizing/eksekusi.

    Dipakai bersama oleh scanner CLI dan paper/live loop (satu sumber kebenaran).
    """
    found: list[tuple[str, str, ArbOpportunity]] = []
    books: dict[str, OrderBook] = {}
    neg_groups: dict[str, list[Market]] = defaultdict(list)

    markets = client.fetch_political_markets(limit=limit, paginate=True)[:max_markets]
    log.info("scanning", markets=len(markets))
    for m in markets:
        for tok in m.tokens:
            try:
                books[tok.token_id] = client.fetch_orderbook(tok.token_id)
            except Exception as e:  # noqa: BLE001
                log.warning("book_fail", token=tok.token_id, err=str(e))

        if len(m.tokens) == 2:
            b0, b1 = books.get(m.tokens[0].token_id), books.get(m.tokens[1].token_id)
            if b0 and b1:
                opp = detect_binary_dutch_book(b0, b1, m.tokens[0].outcome, m.tokens[1].outcome)
                if opp and validate_opportunity(
                    opp, min_edge_pct=min_edge, min_notional_usd=min_notional
                ).passed:
                    found.append((m.id, f"[BINARY] {m.question[:60]}", opp))

        if m.group_id:
            neg_groups[m.group_id].append(m)

    for gid, group in neg_groups.items():
        if len(group) < 2:
            continue
        outcomes, ok = [], True
        for m in group:
            yt = _yes_token(m)
            if not yt or yt not in books:
                ok = False
                break
            outcomes.append((yt, m.question[:30], books[yt]))
        if ok:
            opp = detect_mutually_exclusive(outcomes)
            if opp and validate_opportunity(
                opp, min_edge_pct=min_edge, min_notional_usd=min_notional
            ).passed:
                found.append((gid, f"[GROUP {len(group)}] {gid[:12]}", opp))
    return found


def scan(limit: int = 300, max_markets: int = 80) -> list[tuple[str, ArbOpportunity]]:
    """Wrapper untuk CLI: cari peluang + sizing yang disetujui risk manager."""
    cfg = get_config()
    risk = RiskManager(cfg.risk, bankroll_usd=float(cfg.strategy["paper"]["starting_balance_usd"]))
    out: list[tuple[str, ArbOpportunity]] = []
    with PolymarketReadClient() as client:
        opps = find_opportunities(
            client, limit=limit, max_markets=max_markets,
            min_edge=float(cfg.edge.get("min_edge_threshold", 0.05)),
            min_notional=float(cfg.risk.get("min_orderbook_depth_usd", 50.0)),
        )
    for market_id, desc, opp in opps:
        sizing = risk.size_arbitrage(opp, market_id)
        if sizing.approved:
            out.append((f"{desc} | edge={opp.edge:.3f}/{opp.edge_pct:.1%} "
                        f"| size={sizing.sets} sets ${sizing.notional_usd:.2f}", opp))
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="atlas-poly arbitrage scanner (read-only, no orders)")
    ap.add_argument("--limit", type=int, default=300)
    ap.add_argument("--max-markets", type=int, default=80)
    args = ap.parse_args()

    found = scan(limit=args.limit, max_markets=args.max_markets)
    print(f"\n=== Peluang arbitrage LOLOS filter: {len(found)} ===")
    if not found:
        print("(tidak ada — ini HASIL NORMAL & berharga: pasar efisien saat ini.)")
        print("Hipotesis diuji dengan menjalankan ini berulang selama window 14 hari.")
    for desc, _ in found:
        print(f"  • {desc}")


if __name__ == "__main__":
    main()
