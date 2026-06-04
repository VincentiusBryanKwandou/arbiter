"""Trade journal (FASE 5).

Catat setiap trade paper ke JSONL (storage/paper_journal.jsonl) untuk audit &
evaluasi: bandingkan PnL paper vs ekspektasi backtest. Append-only.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from pydantic import BaseModel, Field

from core.execution.base import ArbResult

JOURNAL_PATH = Path(__file__).resolve().parent.parent / "storage" / "paper_journal.jsonl"


class JournalEntry(BaseModel):
    ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    market_id: str
    desc: str
    filled_sets: float
    locked_profit: float
    fully_filled: bool
    note: str = ""


class TradeJournal:
    def __init__(self, path: Path = JOURNAL_PATH):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def record(self, desc: str, res: ArbResult) -> JournalEntry:
        entry = JournalEntry(
            market_id=res.market_id, desc=desc, filled_sets=res.filled_sets,
            locked_profit=res.locked_profit, fully_filled=res.fully_filled, note=res.note,
        )
        with self.path.open("a", encoding="utf-8") as f:
            f.write(entry.model_dump_json() + "\n")
        return entry

    def entries(self) -> list[JournalEntry]:
        if not self.path.exists():
            return []
        out = []
        with self.path.open("r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    out.append(JournalEntry.model_validate_json(line))
        return out

    def total_pnl(self) -> float:
        return sum(e.locked_profit for e in self.entries())
