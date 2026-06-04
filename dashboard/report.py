"""Laporan status (FASE 7) — read-only.

Ringkas trade journal paper + status terakhir. Jalankan kapan saja:

    python -m dashboard.report
"""

from __future__ import annotations

from pydantic import BaseModel

from paper.journal import TradeJournal


class StatusReport(BaseModel):
    n_trades: int
    total_pnl: float
    win_rate: float
    fully_filled_rate: float

    def pretty(self) -> str:
        return (
            f"trades={self.n_trades}  pnl=${self.total_pnl:.2f}  "
            f"win_rate={self.win_rate:.1%}  fully_filled={self.fully_filled_rate:.1%}"
        )


def build_report(journal: TradeJournal | None = None) -> StatusReport:
    journal = journal or TradeJournal()
    entries = journal.entries()
    n = len(entries)
    wins = sum(1 for e in entries if e.locked_profit > 0)
    filled = sum(1 for e in entries if e.fully_filled)
    return StatusReport(
        n_trades=n,
        total_pnl=sum(e.locked_profit for e in entries),
        win_rate=(wins / n) if n else 0.0,
        fully_filled_rate=(filled / n) if n else 0.0,
    )


def main() -> None:
    rep = build_report()
    print("=== atlas-poly status (paper) ===")
    print(" ", rep.pretty())
    if rep.n_trades == 0:
        print("  (belum ada trade tercatat — jalankan: python -m paper.loop --once)")


if __name__ == "__main__":
    main()
