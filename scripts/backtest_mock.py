"""Generate mock backtest result dan export ke public/data/backtest.json.

  python scripts/backtest_mock.py

Untuk development/demo saat belum ada data historis nyata.
"""

from __future__ import annotations

import json
import random
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent
PUBLIC_DATA = ROOT / "dashboard-web" / "public" / "data"

rng = random.Random(42)


def make_pnls(n: int = 80) -> list[float]:
    return [rng.gauss(0.008, 0.04) for _ in range(n)]


def main() -> None:
    pnls = make_pnls(80)
    total_return = sum(pnls) / 1000.0 * 100
    wins = sum(1 for p in pnls if p > 0)
    avg_pnl = sum(pnls) / len(pnls)

    equity_curve = []
    eq = 1000.0
    for i, p in enumerate(pnls):
        eq += p
        equity_curve.append({"t": i, "equity": round(eq, 4)})

    result = {
        "total_return_pct": round(total_return, 4),
        "sharpe_ratio": round(sum(pnls) / (len(pnls) * 0.04), 3),
        "max_drawdown_pct": round(8.5, 2),
        "win_rate": round(wins / len(pnls), 4),
        "n_trades": len(pnls),
        "n_opportunities": len(pnls) + 15,
        "avg_pnl_per_trade": round(avg_pnl, 6),
        "best_trade": round(max(pnls), 6),
        "worst_trade": round(min(pnls), 6),
        "monte_carlo_ruin_prob": 0.032,
        "equity_curve": equity_curve,
        "pnl_distribution": [],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "note": "MOCK DATA — generated from backtest_mock.py for dashboard demo",
    }

    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)
    out = PUBLIC_DATA / "backtest.json"
    out.write_text(json.dumps(result, indent=2))
    print(f"[mock] backtest.json written: {len(pnls)} trades, return={total_return:.2f}%")


if __name__ == "__main__":
    main()
