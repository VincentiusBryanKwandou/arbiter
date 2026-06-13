"""Collect Polymarket snapshots for historical backtest data.

  python -m paper.snapshot_collector --once --limit 50
  python -m paper.snapshot_collector --interval 300 --limit 100
"""

from __future__ import annotations

import argparse
import time
from datetime import datetime, timezone
from pathlib import Path

import structlog

from core.data.clob_client import PolymarketReadClient
from core.data.store import SnapshotStore

log = structlog.get_logger()
STORAGE = Path(__file__).parent.parent / "storage" / "snapshots"


def collect_once(store: SnapshotStore, limit: int = 100) -> int:
    with PolymarketReadClient() as client:
        markets = client.fetch_political_markets(limit=limit)
        n = 0
        for mkt in markets:
            if len(mkt.tokens) < 2:
                continue
            books = {}
            for tok in mkt.tokens:
                try:
                    ob = client.fetch_orderbook(tok.token_id)
                    books[tok.token_id] = ob
                except Exception as e:
                    log.warning("ob_fetch_fail", token=tok.token_id, err=str(e))
            if len(books) >= 2:
                store.save(mkt.id, books)
                n += 1
    return n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--interval", type=int, default=300)
    ap.add_argument("--limit", type=int, default=100)
    ap.add_argument("--once", action="store_true")
    args = ap.parse_args()

    STORAGE.mkdir(parents=True, exist_ok=True)
    store = SnapshotStore(str(STORAGE))
    log.info("snapshot_collector_start", interval=args.interval)

    while True:
        ts = datetime.now(timezone.utc).isoformat()
        n = collect_once(store, args.limit)
        log.info("collected", ts=ts, n=n)
        if args.once:
            break
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
