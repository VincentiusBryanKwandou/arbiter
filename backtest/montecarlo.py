"""Monte Carlo / bootstrap (FASE 4).

Pertanyaan kunci yang ditanyakan bot serius (dan disembunyikan bot marketing):
"Berapa probabilitas akun saya NOL?"

Metode: bootstrap resampling urutan PnL trade ribuan kali, hitung distribusi
equity akhir & drawdown, lalu estimasi probability of ruin.
"""

from __future__ import annotations

import random

from pydantic import BaseModel

from backtest.metrics import max_drawdown


class MonteCarloResult(BaseModel):
    paths: int
    prob_ruin: float            # fraksi path yang menyentuh <= ruin_threshold
    median_final_equity: float
    p5_final_equity: float      # persentil 5 (skenario buruk)
    p95_final_equity: float
    worst_drawdown_pct: float

    def pretty(self) -> str:
        return (
            f"paths={self.paths}  P(ruin)={self.prob_ruin:.2%}  "
            f"median=${self.median_final_equity:.2f}  "
            f"p5=${self.p5_final_equity:.2f}  p95=${self.p95_final_equity:.2f}  "
            f"worst_dd={self.worst_drawdown_pct:.2%}"
        )


def bootstrap_ruin(
    starting: float,
    pnls: list[float],
    paths: int = 5000,
    ruin_fraction: float = 0.5,
    seed: int | None = 42,
) -> MonteCarloResult:
    """Resample urutan trade `paths` kali.

    ruin_fraction: equity dianggap 'ruin' kalau turun ke <= fraksi ini dari modal awal.
    """
    if not pnls:
        return MonteCarloResult(paths=0, prob_ruin=0.0, median_final_equity=starting,
                                p5_final_equity=starting, p95_final_equity=starting,
                                worst_drawdown_pct=0.0)
    rng = random.Random(seed)
    ruin_level = starting * ruin_fraction
    finals: list[float] = []
    ruins = 0
    worst_dd = 0.0
    n = len(pnls)
    for _ in range(paths):
        seq = [pnls[rng.randrange(n)] for _ in range(n)]  # resample with replacement
        eq = starting
        curve = [eq]
        hit_ruin = False
        for p in seq:
            eq += p
            curve.append(eq)
            if eq <= ruin_level:
                hit_ruin = True
        if hit_ruin:
            ruins += 1
        finals.append(eq)
        worst_dd = max(worst_dd, max_drawdown(curve))
    finals.sort()

    def pct(q: float) -> float:
        idx = min(len(finals) - 1, max(0, int(q * len(finals))))
        return finals[idx]

    return MonteCarloResult(
        paths=paths,
        prob_ruin=ruins / paths,
        median_final_equity=pct(0.5),
        p5_final_equity=pct(0.05),
        p95_final_equity=pct(0.95),
        worst_drawdown_pct=worst_dd,
    )
