"""Engine backtest event-driven (FASE 4).

Replay MarketSnapshot urut waktu, jalankan rantai DETECT -> VALIDATE -> SIZE -> FILL
(simulasi), kumpulkan PnL, hitung metrik. Tidak ada look-ahead: tiap keputusan
hanya pakai data snapshot saat itu.

Fokus: binary dutch-book intra-market (yang datanya ada di tiap snapshot).
"""

from __future__ import annotations

from collections.abc import Iterable

from pydantic import BaseModel

from backtest.metrics import BacktestMetrics, compute_metrics
from core.data.models import MarketSnapshot, OrderBook
from core.edge.arbitrage import detect_binary_dutch_book
from core.edge.signals import validate_opportunity
from core.execution.base import ArbResult
from core.execution.sim import SimulatedBroker
from core.risk.limits import RiskManager


class BacktestReport(BaseModel):
    metrics: BacktestMetrics
    pnls: list[float]
    n_opportunities: int       # lolos validasi
    n_executed: int            # disetujui risk + dieksekusi


def run_backtest(
    snapshots: Iterable[MarketSnapshot],
    *,
    risk_cfg: dict,
    starting_bankroll: float = 1000.0,
    min_edge_pct: float = 0.05,
    min_notional_usd: float = 50.0,
    cost_per_tx: float = 0.02,
) -> BacktestReport:
    broker = SimulatedBroker(starting_cash=starting_bankroll)
    risk = RiskManager(risk_cfg, bankroll_usd=starting_bankroll)
    results: list[ArbResult] = []
    n_opp = 0

    # urutkan berdasar waktu (no look-ahead)
    snaps = sorted(snapshots, key=lambda s: s.ts)
    for snap in snaps:
        books: list[OrderBook] = list(snap.books.values())
        if len(books) != 2:
            continue
        opp = detect_binary_dutch_book(books[0], books[1])
        if opp is None:
            continue
        res = validate_opportunity(opp, min_edge_pct=min_edge_pct, min_notional_usd=min_notional_usd)
        if not res.passed:
            continue
        n_opp += 1
        sizing = risk.size_arbitrage(opp, snap.market_id)
        if not sizing.approved:
            continue
        fill = broker.place_arb(opp, snap.market_id, sizing.sets, cost_per_tx=cost_per_tx)
        risk.register_open(snap.market_id, sizing.notional_usd)
        risk.register_close(snap.market_id, fill.locked_profit)  # arb realize cepat
        results.append(fill)

    pnls = [r.locked_profit for r in results]
    metrics = compute_metrics(starting_bankroll, pnls)
    return BacktestReport(
        metrics=metrics, pnls=pnls, n_opportunities=n_opp, n_executed=len(results)
    )
