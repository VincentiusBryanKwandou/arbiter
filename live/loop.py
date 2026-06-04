"""Live loop (FASE 6) — UANG NYATA. Default menolak berjalan.

Strukturnya identik dengan paper/loop.py tapi broker = LiveBroker (order nyata).
Hanya berjalan kalau SEMUA guard di live/executor.py lolos.

    python -m live.loop --once     # tetap akan GAGAL kalau guard tak terpenuhi

JANGAN jalankan sebelum Fase 4 & 5 lolos dan Anda paham leg-risk.
"""

from __future__ import annotations

import argparse

import structlog

from core.config import get_config
from core.data.clob_client import PolymarketReadClient
from core.edge.scanner import find_opportunities
from core.risk.limits import RiskManager
from live.executor import LiveBroker, LiveGuardError
from paper.journal import TradeJournal

log = structlog.get_logger()


def main() -> None:
    ap = argparse.ArgumentParser(description="atlas-poly LIVE loop (REAL MONEY — guarded)")
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--max-trades", type=int, default=1, help="batas trade per run (mulai 1)")
    args = ap.parse_args()

    cfg = get_config()
    try:
        broker = LiveBroker(cfg)  # <-- gagal di sini kalau guard tak lolos
    except LiveGuardError as e:
        print(f"[LIVE BLOCKED] {e}")
        print("Live executor menolak berjalan. Ini PERILAKU YANG BENAR kecuali Anda")
        print("sudah lolos Fase 4 & 5 dan sengaja mengaktifkan semua guard.")
        return

    start_cash = broker.balance()
    risk = RiskManager(cfg.risk, bankroll_usd=start_cash or 20.0)
    journal = TradeJournal()

    placed = 0
    with PolymarketReadClient() as client:
        opps = find_opportunities(
            client, limit=300, max_markets=80,
            min_edge=float(cfg.edge.get("min_edge_threshold", 0.05)),
            min_notional=float(cfg.risk.get("min_orderbook_depth_usd", 50.0)),
        )
    for market_id, desc, opp in opps:
        if placed >= args.max_trades:
            break
        sizing = risk.size_arbitrage(opp, market_id)
        if not sizing.approved:
            continue
        res = broker.place_arb(opp, market_id, sizing.sets,
                               cost_per_tx=float(cfg.strategy["backtest"]["cost_model"]["gas_usd_per_tx"]))
        journal.record(desc, res)
        log.warning("LIVE_TRADE", desc=desc, note=res.note)
        placed += 1
    print(f"[LIVE] selesai. order ditempatkan: {placed}")


if __name__ == "__main__":
    main()
