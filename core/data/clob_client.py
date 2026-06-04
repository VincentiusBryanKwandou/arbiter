"""Klien Polymarket READ-ONLY (Fase 1).

Tidak butuh wallet / private key / API key. Hanya endpoint publik:
  * Gamma API  -> metadata market (filter politik di sini)
  * CLOB  /book -> orderbook per token

Parsing dipisah dari network (fungsi `parse_market` / `parse_orderbook`)
supaya bisa diuji offline tanpa internet.
"""

from __future__ import annotations

import json
from typing import Any

import httpx
import structlog

from core.data.models import BookLevel, Market, OrderBook, Token

log = structlog.get_logger()

GAMMA_HOST = "https://gamma-api.polymarket.com"
CLOB_HOST = "https://clob.polymarket.com"

# Kata kunci untuk mendeteksi market politik secara client-side (Gamma tagging
# tidak selalu konsisten, jadi kita pakai heuristik tag + teks).
POLITICS_KEYWORDS = (
    "politic",
    "election",
    "president",
    "senate",
    "congress",
    "governor",
    "primary",
    "parliament",
    "vote",
    "ballot",
)


def _to_float(x: Any, default: float = 0.0) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def _maybe_json_list(x: Any) -> list[Any]:
    """Gamma mengirim beberapa field sebagai string JSON; normalkan ke list."""
    if isinstance(x, list):
        return x
    if isinstance(x, str) and x.strip():
        try:
            v = json.loads(x)
            return v if isinstance(v, list) else []
        except json.JSONDecodeError:
            return []
    return []


def parse_market(raw: dict[str, Any]) -> Market | None:
    """Ubah satu objek market Gamma -> Market. None kalau tidak bisa dipakai."""
    token_ids = [str(t) for t in _maybe_json_list(raw.get("clobTokenIds"))]
    outcomes = [str(o) for o in _maybe_json_list(raw.get("outcomes"))]
    if not token_ids:
        return None
    tokens = [
        Token(token_id=tid, outcome=outcomes[i] if i < len(outcomes) else f"OUT{i}")
        for i, tid in enumerate(token_ids)
    ]
    tags_raw = raw.get("tags") or []
    tags = [str(t.get("label", t)) if isinstance(t, dict) else str(t) for t in tags_raw]
    # group_id: satukan market saling-eksklusif. Prioritas: negRiskMarketID,
    # lalu id event pertama (Gamma menyertakan `events` yang mengelompokkan market).
    group_id = raw.get("negRiskMarketID") or raw.get("neg_risk_market_id")
    if not group_id:
        events = raw.get("events") or []
        if events and isinstance(events[0], dict):
            group_id = str(events[0].get("id") or "") or None
    return Market(
        id=str(raw.get("id", "")),
        question=str(raw.get("question", "")),
        slug=str(raw.get("slug", "")),
        tokens=tokens,
        active=bool(raw.get("active", True)),
        closed=bool(raw.get("closed", False)),
        volume=_to_float(raw.get("volume")),
        liquidity=_to_float(raw.get("liquidity")),
        neg_risk_market_id=raw.get("negRiskMarketID") or raw.get("neg_risk_market_id"),
        group_id=group_id,
        neg_risk=bool(raw.get("negRisk", False)),
        tags=tags,
    )


def is_political(market: Market) -> bool:
    """Heuristik: cek tag + teks pertanyaan terhadap POLITICS_KEYWORDS."""
    haystack = " ".join([market.question, market.slug, *market.tags]).lower()
    return any(kw in haystack for kw in POLITICS_KEYWORDS)


def parse_orderbook(token_id: str, raw: dict[str, Any]) -> OrderBook:
    """Ubah respons CLOB /book -> OrderBook."""

    def _levels(key: str) -> list[BookLevel]:
        out = []
        for lvl in raw.get(key, []) or []:
            out.append(BookLevel(price=_to_float(lvl.get("price")), size=_to_float(lvl.get("size"))))
        return out

    return OrderBook(token_id=token_id, bids=_levels("bids"), asks=_levels("asks"))


class PolymarketReadClient:
    """Klien read-only. Pakai sebagai context manager.

    Contoh:
        with PolymarketReadClient() as c:
            mkts = c.fetch_political_markets(limit=50)
            book = c.fetch_orderbook(mkts[0].tokens[0].token_id)
    """

    def __init__(self, gamma_host: str = GAMMA_HOST, clob_host: str = CLOB_HOST, timeout: float = 15.0):
        self.gamma_host = gamma_host.rstrip("/")
        self.clob_host = clob_host.rstrip("/")
        self._client = httpx.Client(timeout=timeout, headers={"User-Agent": "atlas-poly/0.0.1"})

    def __enter__(self) -> PolymarketReadClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def close(self) -> None:
        self._client.close()

    # --- network ---
    def fetch_markets(self, limit: int = 100, only_open: bool = True) -> list[Market]:
        params: dict[str, Any] = {"limit": limit, "order": "volume", "ascending": "false"}
        if only_open:
            params["active"] = "true"
            params["closed"] = "false"
        r = self._client.get(f"{self.gamma_host}/markets", params=params)
        r.raise_for_status()
        data = r.json()
        rows = data if isinstance(data, list) else data.get("data", [])
        out: list[Market] = []
        for raw in rows:
            m = parse_market(raw)
            if m:
                out.append(m)
        log.info("fetch_markets", count=len(out))
        return out

    def fetch_markets_paginated(self, total: int = 500, page_size: int = 100) -> list[Market]:
        """Tarik banyak market via offset pagination (untuk menjaring lebih banyak
        market politik & membentuk grup neg-risk yang utuh)."""
        out: list[Market] = []
        offset = 0
        while len(out) < total:
            params = {
                "limit": page_size,
                "offset": offset,
                "active": "true",
                "closed": "false",
                "order": "volume",
                "ascending": "false",
            }
            r = self._client.get(f"{self.gamma_host}/markets", params=params)
            r.raise_for_status()
            data = r.json()
            rows = data if isinstance(data, list) else data.get("data", [])
            if not rows:
                break
            for raw in rows:
                m = parse_market(raw)
                if m:
                    out.append(m)
            offset += page_size
        log.info("fetch_markets_paginated", count=len(out))
        return out

    def fetch_political_markets(self, limit: int = 200, paginate: bool = False) -> list[Market]:
        src = self.fetch_markets_paginated(total=limit) if paginate else self.fetch_markets(limit=limit)
        return [m for m in src if is_political(m)]

    def fetch_orderbook(self, token_id: str) -> OrderBook:
        r = self._client.get(f"{self.clob_host}/book", params={"token_id": token_id})
        r.raise_for_status()
        return parse_orderbook(token_id, r.json())
