"""Runner backtest (FASE 4): jalankan di snapshot yang sudah dikumpulkan.

    python -m backtest.run

Membaca storage/snapshots/*.jsonl, jalankan walk-forward + Monte Carlo,
dan cetak verdict JUJUR: apakah ada edge out-of-sample setelah biaya?

Kalau belum ada data (Fase 1 belum dijalankan berhari-hari), runner memberi
tahu — backtest tanpa data tidak bermakna.
"""

from __future__ import annotations

from backtest.engine import run_backtest
from backtest.montecarlo import bootstrap_ruin
from backtest.walkforward import split_by_time
from core.config import get_config
from core.data.store import SnapshotStore


def main() -> None:
    cfg = get_config()
    store = SnapshotStore()
    snaps = list(store.iter_snapshots())

    print(f"Snapshot tersedia: {len(snaps)}")
    if len(snaps) < 50:
        print("\n[!] Data terlalu sedikit untuk backtest bermakna.")
        print("    Jalankan collector berulang dulu (idealnya window 14 hari):")
        print("    python -m core.data.collect")
        return

    starting = float(cfg.strategy["paper"]["starting_balance_usd"])
    train_pct = float(cfg.strategy["backtest"]["walk_forward_train_pct"])
    cost = float(cfg.strategy["backtest"]["cost_model"]["gas_usd_per_tx"])
    min_edge = float(cfg.edge.get("min_edge_threshold", 0.05))
    min_notional = float(cfg.risk.get("min_orderbook_depth_usd", 50.0))
    mc_paths = int(cfg.strategy["backtest"]["monte_carlo_paths"])

    train, test = split_by_time(snaps, train_pct=train_pct)
    common = dict(risk_cfg=cfg.risk, starting_bankroll=starting,
                  min_edge_pct=min_edge, min_notional_usd=min_notional, cost_per_tx=cost)

    rep_train = run_backtest(train, **common)
    rep_test = run_backtest(test, **common)

    print("\n=== IN-SAMPLE (train) ===")
    print(" ", rep_train.metrics.pretty())
    print("\n=== OUT-OF-SAMPLE (test) — INI yang menentukan ===")
    print(" ", rep_test.metrics.pretty())

    if rep_test.pnls:
        mc = bootstrap_ruin(starting, rep_test.pnls, paths=mc_paths)
        print("\n=== MONTE CARLO (out-of-sample) ===")
        print(" ", mc.pretty())

    verdict = (
        rep_test.metrics.total_return_usd > 0
        and rep_test.n_executed >= 10
        and rep_test.metrics.max_drawdown_pct < 0.5
    )
    print("\n=== VERDICT ===")
    print("  ✅ Edge bertahan out-of-sample — boleh lanjut paper trading."
          if verdict else
          "  ❌ Belum ada edge meyakinkan. JANGAN live. Pivot/iterasi hipotesis.")


if __name__ == "__main__":
    main()
