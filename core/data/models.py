"""Model data inti — bentuk objek yang mengalir lewat seluruh bot.

Sengaja toleran terhadap field tambahan dari API (extra="ignore") karena
skema Polymarket bisa berubah; kita hanya peduli field yang kita pakai.
"""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BookLevel(BaseModel):
    """Satu level di orderbook."""

    price: float
    size: float


class OrderBook(BaseModel):
    """Orderbook untuk satu token (outcome). bids turun, asks naik."""

    token_id: str
    bids: list[BookLevel] = Field(default_factory=list)
    asks: list[BookLevel] = Field(default_factory=list)
    ts: datetime = Field(default_factory=_utcnow)

    @property
    def best_bid(self) -> float | None:
        return max((b.price for b in self.bids), default=None)

    @property
    def best_ask(self) -> float | None:
        return min((a.price for a in self.asks), default=None)

    @property
    def mid(self) -> float | None:
        if self.best_bid is None or self.best_ask is None:
            return None
        return (self.best_bid + self.best_ask) / 2

    @property
    def spread(self) -> float | None:
        if self.best_bid is None or self.best_ask is None:
            return None
        return self.best_ask - self.best_bid

    def depth_usd(self, side: str = "ask") -> float:
        """Total nilai (price*size) di satu sisi — proxy likuiditas."""
        levels = self.asks if side == "ask" else self.bids
        return sum(lvl.price * lvl.size for lvl in levels)


class Token(BaseModel):
    """Satu outcome token dalam sebuah market (mis. 'Yes' / 'No')."""

    token_id: str
    outcome: str


class Market(BaseModel):
    """Metadata market Polymarket (dari Gamma API)."""

    id: str
    question: str
    slug: str = ""
    tokens: list[Token] = Field(default_factory=list)
    active: bool = True
    closed: bool = False
    end_date: datetime | None = None
    volume: float = 0.0
    liquidity: float = 0.0
    # Grup untuk arbitrage: market dengan neg_risk_market_id sama = saling eksklusif
    # (mis. semua kandidat dalam satu pemilu).
    neg_risk_market_id: str | None = None
    # group_id: id event/grup yang menyatukan market saling-eksklusif (mis. 1 pemilu).
    group_id: str | None = None
    neg_risk: bool = False
    tags: list[str] = Field(default_factory=list)


class MarketSnapshot(BaseModel):
    """Foto satu market pada satu waktu: metadata + orderbook tiap token.

    Inilah unit yang kita simpan ke storage untuk observasi & backtest.
    """

    market_id: str
    question: str
    ts: datetime = Field(default_factory=_utcnow)
    books: dict[str, OrderBook] = Field(default_factory=dict)  # token_id -> book

    def implied_prob(self, token_id: str) -> float | None:
        """Probabilitas implisit = mid price token tsb."""
        book = self.books.get(token_id)
        return book.mid if book else None
