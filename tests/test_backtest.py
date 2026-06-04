"""Test FASE 4: metrik, Monte Carlo, engine backtest, walk-forward."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from backtest.engine import run_backtest
from backtest.metrics import compute_metrics, max_drawdown, sharpe
from backtest.montecarlo import bootstrap_ruin
from backtest.walkforward import split_by_time
from core.data.models import BookLevel, MarketSnapshot, OrderBook

RISK_CFG = {"max_per_trade_pct": 0.5, "max_per_market_pct": 0.5, "max_open_positions": 100,
            "min_orderbook_depth_usd": 1.0, "daily_loss_limit_pct": 0.99}


def test_max_drawdown():
    assert max_drawdown([100, 120, 60, 80]) == (120 - 60) / 120


def test_sharpe_zero_for_constant():
    assert sharpe([1.0, 1.0, 1.0]) == 0.0


def test_compute_metrics_basic():
    m = compute_metrics(1000, [10, -5, 20, -2])
    assert m.n_trades == 4
    assert m.total_return_usd == 23
    assert 0 < m.win_rate < 1


def test_montecarlo_no_ruin_for_positive_edge():
    mc = bootstrap_ruin(1000, [5.0] * 50, paths=500)
    assert mc.prob_ruin == 0.0
    assert mc.median_final_equity > 1000


def test_montecarlo_detects_ruin_for_negative_edge():
    mc = bootstrap_ruin(100, [-30.0] * 20, paths=500, ruin_fraction=0.5)
    assert mc.prob_ruin > 0.5


def _arb_snapshot(ts, yes_ask, no_ask, size=1000.0, mid="m1"):
    return MarketSnapshot(
        market_id=mid, question="Will X win?", ts=ts,
        books={
            "yes": OrderBook(token_id="yes", bids=[BookLevel(price=yes_ask - 0.02, size=size)],
                             asks=[BookLevel(price=yes_ask, size=size)]),
            "no": OrderBook(token_id="no", bids=[BookLevel(price=no_ask - 0.02, size=size)],
                            asks=[BookLevel(price=no_ask, size=size)]),
        },
    )


def test_backtest_executes_arbitrage_and_profits():
    base = datetime(2026, 6, 1, tzinfo=timezone.utc)
    snaps = [_arb_snapshot(base + timedelta(hours=i), 0.45, 0.50, mid=f"m{i}") for i in range(15)]
    rep = run_backtest(snaps, risk_cfg=RISK_CFG, starting_bankroll=1000,
                       min_edge_pct=0.01, min_notional_usd=1.0, cost_per_tx=0.0)
    assert rep.n_executed == 15
    assert rep.metrics.total_return_usd > 0


def test_backtest_ignores_efficient_markets():
    base = datetime(2026, 6, 1, tzinfo=timezone.utc)
    snaps = [_arb_snapshot(base + timedelta(hours=i), 0.55, 0.50) for i in range(10)]  # sum 1.05
    rep = run_backtest(snaps, risk_cfg=RISK_CFG, starting_bankroll=1000,
                       min_edge_pct=0.01, min_notional_usd=1.0)
    assert rep.n_executed == 0


def test_walkforward_split_is_time_ordered():
    base = datetime(2026, 6, 1, tzinfo=timezone.utc)
    snaps = [_arb_snapshot(base + timedelta(hours=i), 0.45, 0.50) for i in range(10)]
    train, test = split_by_time(snaps, train_pct=0.6)
    assert len(train) == 6 and len(test) == 4
    assert train[-1].ts < test[0].ts
