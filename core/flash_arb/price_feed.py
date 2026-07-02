"""Multi-DEX price feed for Base mainnet.

Uses direct on-chain calls (no API key required):
  - Uniswap V3 QuoterV2.quoteExactInputSingle  (per fee tier)
  - Aerodrome Router.getAmountsOut              (volatile + stable pools)
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Optional

from web3 import AsyncWeb3, WebSocketProvider
from web3.providers import AsyncHTTPProvider

from core.flash_arb import config
from core.flash_arb.abis import QUOTER_V2_ABI, AERODROME_ROUTER_ABI

log = logging.getLogger(__name__)


@dataclass
class Quote:
    dex: str          # e.g. "uniswap_v3_500", "aerodrome_volatile"
    token_in: str
    token_out: str
    amount_in: int
    amount_out: int
    gas_estimate: int = 0

    @property
    def price(self) -> float:
        """Output per input unit (both in raw integer form → dimensionless ratio)."""
        return self.amount_out / self.amount_in if self.amount_in else 0.0


class PriceFeed:
    """Async price feed that queries multiple DEXes in parallel."""

    def __init__(self, rpc_url: str = config.BASE_RPC_URL) -> None:
        self._w3 = AsyncWeb3(AsyncHTTPProvider(rpc_url))
        self._quoter = self._w3.eth.contract(
            address=self._w3.to_checksum_address(config.UNISWAP_V3_QUOTER),
            abi=QUOTER_V2_ABI,
        )
        self._aero = self._w3.eth.contract(
            address=self._w3.to_checksum_address(config.AERODROME_ROUTER),
            abi=AERODROME_ROUTER_ABI,
        )

    # ── Uniswap V3 ───────────────────────────────────────────────────────────

    async def quote_uni_v3(
        self, token_in: str, token_out: str, amount_in: int, fee: int
    ) -> Optional[Quote]:
        """Quote a single Uniswap V3 pool at `fee` tier."""
        try:
            result = await self._quoter.functions.quoteExactInputSingle({
                "tokenIn":              self._w3.to_checksum_address(token_in),
                "tokenOut":             self._w3.to_checksum_address(token_out),
                "amountIn":             amount_in,
                "fee":                  fee,
                "sqrtPriceLimitX96":    0,
            }).call()
            amount_out, _, _, gas = result
            return Quote(
                dex=f"uniswap_v3_{fee}",
                token_in=token_in,
                token_out=token_out,
                amount_in=amount_in,
                amount_out=amount_out,
                gas_estimate=gas,
            )
        except Exception as e:
            log.debug("Uni V3 quote failed (token_in=%s fee=%s): %s", token_in[-6:], fee, e)
            return None

    async def quote_uni_v3_all_fees(
        self, token_in: str, token_out: str, amount_in: int
    ) -> list[Quote]:
        """Quote all Uniswap V3 fee tiers for a pair in parallel."""
        tasks = [
            self.quote_uni_v3(token_in, token_out, amount_in, fee)
            for fee in (config.FEE_LOWEST, config.FEE_LOW, config.FEE_MEDIUM, config.FEE_HIGH)
        ]
        results = await asyncio.gather(*tasks)
        return [q for q in results if q is not None]

    # ── Aerodrome ─────────────────────────────────────────────────────────────

    async def quote_aerodrome(
        self, token_in: str, token_out: str, amount_in: int, stable: bool = False
    ) -> Optional[Quote]:
        """Quote an Aerodrome pool (volatile or stable)."""
        try:
            routes = [{
                "from":    self._w3.to_checksum_address(token_in),
                "to":      self._w3.to_checksum_address(token_out),
                "stable":  stable,
                "factory": self._w3.to_checksum_address(config.AERODROME_FACTORY),
            }]
            amounts = await self._aero.functions.getAmountsOut(amount_in, routes).call()
            return Quote(
                dex=f"aerodrome_{'stable' if stable else 'volatile'}",
                token_in=token_in,
                token_out=token_out,
                amount_in=amount_in,
                amount_out=amounts[-1],
            )
        except Exception as e:
            log.debug("Aerodrome quote failed (stable=%s): %s", stable, e)
            return None

    async def quote_aerodrome_both(
        self, token_in: str, token_out: str, amount_in: int
    ) -> list[Quote]:
        """Quote both Aerodrome pool types in parallel."""
        tasks = [
            self.quote_aerodrome(token_in, token_out, amount_in, stable=False),
            self.quote_aerodrome(token_in, token_out, amount_in, stable=True),
        ]
        results = await asyncio.gather(*tasks)
        return [q for q in results if q is not None]

    # ── Combined ──────────────────────────────────────────────────────────────

    async def get_all_quotes(
        self, token_in: str, token_out: str, amount_in: int
    ) -> list[Quote]:
        """Get quotes from all DEXes + all fee tiers for a pair."""
        uni_task   = self.quote_uni_v3_all_fees(token_in, token_out, amount_in)
        aero_task  = self.quote_aerodrome_both(token_in, token_out, amount_in)
        uni_quotes, aero_quotes = await asyncio.gather(uni_task, aero_task)
        all_quotes = uni_quotes + aero_quotes
        all_quotes.sort(key=lambda q: q.amount_out, reverse=True)
        return all_quotes
