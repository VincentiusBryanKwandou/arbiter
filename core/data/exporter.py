"""Append individual trade to JSON journal used by dashboard."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
JOURNAL_PATH = ROOT / "storage" / "journal" / "trades.json"
OPP_PATH = ROOT / "storage" / "reports" / "opportunities.json"


def append_trade(trade_dict: dict) -> None:
    JOURNAL_PATH.parent.mkdir(parents=True, exist_ok=True)
    trades: list[dict] = []
    if JOURNAL_PATH.exists():
        try:
            trades = json.loads(JOURNAL_PATH.read_text())
        except Exception:
            trades = []
    trade_dict.setdefault("id", f"t_{len(trades)+1:06d}")
    trade_dict.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    trades.append(trade_dict)
    JOURNAL_PATH.write_text(json.dumps(trades, indent=2))


def save_opportunities(opps: list[dict]) -> None:
    OPP_PATH.parent.mkdir(parents=True, exist_ok=True)
    OPP_PATH.write_text(json.dumps(opps, indent=2))
