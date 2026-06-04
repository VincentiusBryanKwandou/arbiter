"""Abstraksi eksekusi bersama (dipakai backtest, paper, live).

Satu interface `Broker` supaya loop trading identik di ketiga mode —
yang berbeda hanya implementasi `place_order`. Ini mencegah "drift" antara
hasil backtest, paper, dan live (penyebab umum bot gagal di dunia nyata).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field

from core.edge.arbitrage import ArbOpportunity


class Side(str, Enum):
    BUY = "buy"
    SELL = "sell"


class Order(BaseModel):
    token_id: str
    side: Side = Side.BUY
    price: float          # harga limit
    size: float           # jumlah share
    label: str = ""


class Fill(BaseModel):
    token_id: str
    price: float
    size: float           # size yang benar-benar terisi (bisa < order.size)
    ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def notional(self) -> float:
        return self.price * self.size


class ArbResult(BaseModel):
    """Hasil eksekusi satu peluang arbitrage."""

    market_id: str
    fills: list[Fill] = Field(default_factory=list)
    requested_sets: float = 0.0
    filled_sets: float = 0.0      # min size terisi di semua leg (yang benar-benar terkunci)
    cost: float = 0.0             # total biaya tx
    locked_profit: float = 0.0    # profit terkunci (untuk arb lengkap)
    fully_filled: bool = False
    note: str = ""


def orders_from_opportunity(opp: ArbOpportunity, sets: float) -> list[Order]:
    """Pecah satu peluang arb menjadi order per-leg untuk `sets` set."""
    return [
        Order(token_id=leg.token_id, side=Side.BUY, price=leg.price, size=sets, label=leg.label)
        for leg in opp.legs
    ]


class Broker(ABC):
    """Interface broker. place_arb mengeksekusi semua leg sebuah peluang."""

    @abstractmethod
    def place_arb(self, opp: ArbOpportunity, market_id: str, sets: float, cost_per_tx: float) -> ArbResult:
        ...

    @abstractmethod
    def balance(self) -> float:
        ...
