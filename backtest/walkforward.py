"""Walk-forward split (FASE 4).

Pisahkan snapshot berdasar WAKTU: latih/kalibrasi di periode awal, uji di periode
akhir yang belum dilihat. Mencegah penipuan-diri overfitting (strategi yang cuma
jago di data yang sudah dilihat).
"""

from __future__ import annotations

from core.data.models import MarketSnapshot


def split_by_time(
    snapshots: list[MarketSnapshot], train_pct: float = 0.6
) -> tuple[list[MarketSnapshot], list[MarketSnapshot]]:
    if not snapshots:
        return [], []
    ordered = sorted(snapshots, key=lambda s: s.ts)
    cut = int(len(ordered) * train_pct)
    return ordered[:cut], ordered[cut:]
