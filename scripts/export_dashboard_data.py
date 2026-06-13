"""Export bot data ke JSON untuk dashboard Next.js.

Output: dashboard-web/public/data/*.json (ter-commit → Vercel baca saat deploy)
Untuk live update lokal: API routes baca dari storage/ langsung.
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone, date
from pathlib import Path

ROOT = Path(__file__).parent.parent
STORAGE = ROOT / "storage"
PUBLIC_DATA = ROOT / "dashboard-web" / "public" / "data"


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_dirs() -> None:
    for d in [STORAGE / "reports", STORAGE / "journal", PUBLIC_DATA]:
        d.mkdir(parents=True, exist_ok=True)


def load_journal() -> list[dict]:
    jf = STORAGE / "journal" / "trades.json"
    if jf.exists():
        try:
            return json.loads(jf.read_text())
        except Exception:
            return []
    return []


def compute_stats(trades: list[dict]) -> dict:
    today = date.today().isoformat()
    today_trades = [t for t in trades if t.get("timestamp", "").startswith(today)]
    total_pnl = sum(t.get("locked_profit", 0) for t in trades)
    today_pnl = sum(t.get("locked_profit", 0) for t in today_trades)
    wins = sum(1 for t in trades if t.get("locked_profit", 0) > 0)
    win_rate = wins / len(trades) if trades else 0
    avg_edge = sum(t.get("edge_pct", 0) for t in trades) / len(trades) if trades else 0

    try:
        import yaml
        cfg_path = ROOT / "config" / "settings.yaml"
        cfg = yaml.safe_load(cfg_path.read_text()) if cfg_path.exists() else {}
        bankroll = float(cfg.get("paper", {}).get("starting_balance_usd", 1000))
    except Exception:
        bankroll = 1000.0

    return {
        "mode": os.getenv("ATLAS_MODE", "paper"),
        "uptime_hours": 0,
        "last_scan_at": utcnow(),
        "opportunities_found_today": len(today_trades),
        "trades_today": len(today_trades),
        "realized_pnl_today": round(today_pnl, 4),
        "realized_pnl_total": round(total_pnl, 4),
        "win_rate": round(win_rate, 4),
        "avg_edge_pct": round(avg_edge, 4),
        "kill_switch_active": False,
        "daily_loss_pct": 0,
        "bankroll_usd": round(bankroll + total_pnl, 2),
        "open_positions": 0,
        "max_open_positions": 5,
    }


def compute_equity(trades: list[dict]) -> list[dict]:
    if not trades:
        return []
    equity = 1000.0
    history = []
    for t in sorted(trades, key=lambda x: x.get("timestamp", "")):
        equity += t.get("locked_profit", 0)
        history.append({
            "date": t.get("timestamp", utcnow()),
            "equity": round(equity, 4),
            "pnl": round(t.get("locked_profit", 0), 6),
        })
    return history


def export_all(dry_run: bool = False) -> None:
    ensure_dirs()
    trades = load_journal()
    stats = compute_stats(trades)
    equity = compute_equity(trades)
    opps_file = STORAGE / "reports" / "opportunities.json"
    opps: list[dict] = []
    if opps_file.exists():
        try:
            opps = json.loads(opps_file.read_text())
        except Exception:
            pass

    if dry_run:
        print(f"[export] dry-run OK | trades={len(trades)} equity_pts={len(equity)} opps={len(opps)}")
        return

    (PUBLIC_DATA / "stats.json").write_text(json.dumps(stats, indent=2))
    (PUBLIC_DATA / "trades.json").write_text(json.dumps(trades[-100:], indent=2))
    (PUBLIC_DATA / "equity.json").write_text(json.dumps(equity, indent=2))
    (PUBLIC_DATA / "opportunities.json").write_text(json.dumps(opps, indent=2))
    (STORAGE / "reports" / "stats.json").write_text(json.dumps(stats, indent=2))
    print(f"[export] OK: {len(trades)} trades, {len(equity)} equity pts → public/data/")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    export_all(dry_run=args.dry_run)
