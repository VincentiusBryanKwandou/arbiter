"""Metrik backtest (FASE 4) — dilaporkan JUJUR, bukan cuma total profit.

Termasuk yang sering disembunyikan bot marketing: max drawdown & probability
of ruin (lihat montecarlo.py).
"""

from __future__ import annotations

import math

from pydantic import BaseModel


class BacktestMetrics(BaseModel):
    n_trades: int
    total_return_usd: float
    total_return_pct: float
    win_rate: float
    avg_return_per_trade: float
    max_drawdown_pct: float
    sharpe: float
    final_equity: float

    def pretty(self) -> str:
        return (
            f"trades={self.n_trades}  return=${self.total_return_usd:.2f} "
            f"({self.total_return_pct:.2%})  win_rate={self.win_rate:.1%}  "
            f"max_dd={self.max_drawdown_pct:.2%}  sharpe={self.sharpe:.2f}  "
            f"equity=${self.final_equity:.2f}"
        )


def equity_curve(starting: float, pnls: list[float]) -> list[float]:
    eq = [starting]
    for p in pnls:
        eq.append(eq[-1] + p)
    return eq


def max_drawdown(equity: list[float]) -> float:
    """Max drawdown sebagai fraksi (0..1)."""
    peak = equity[0]
    mdd = 0.0
    for v in equity:
        peak = max(peak, v)
        if peak > 0:
            mdd = max(mdd, (peak - v) / peak)
    return mdd


def sharpe(pnls: list[float]) -> float:
    """Sharpe per-trade (tanpa anualisasi; relatif untuk membandingkan strategi)."""
    if len(pnls) < 2:
        return 0.0
    mean = sum(pnls) / len(pnls)
    var = sum((p - mean) ** 2 for p in pnls) / (len(pnls) - 1)
    sd = math.sqrt(var)
    return mean / sd if sd > 0 else 0.0


def compute_metrics(starting: float, pnls: list[float]) -> BacktestMetrics:
    eq = equity_curve(starting, pnls)
    total = sum(pnls)
    wins = sum(1 for p in pnls if p > 0)
    n = len(pnls)
    return BacktestMetrics(
        n_trades=n,
        total_return_usd=total,
        total_return_pct=(total / starting) if starting > 0 else 0.0,
        win_rate=(wins / n) if n else 0.0,
        avg_return_per_trade=(total / n) if n else 0.0,
        max_drawdown_pct=max_drawdown(eq),
        sharpe=sharpe(pnls),
        final_equity=eq[-1],
    )
