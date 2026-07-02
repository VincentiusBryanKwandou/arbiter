"""Profit calculator for flash loan arbitrage.

Given buy and sell quotes, calculates whether an arb is profitable after:
  - Aave V3 flash loan fee (0.05%)
  - Estimated gas cost (very low on Base)
  - Minimum profit threshold
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

from web3 import Web3

from core.flash_arb import config
from core.flash_arb.price_feed import Quote

log = logging.getLogger(__name__)

# Aave V3 flash fee = 0.05%  →  premium = amount * 5 / 10_000
AAVE_FEE_NUMERATOR   = 5
AAVE_FEE_DENOMINATOR = 10_000

# Uniswap V3 exactInput on Base: ~130k-180k gas per swap
# Aerodrome: ~80k-120k gas per swap
GAS_PER_SWAP = 180_000
FLASH_LOAN_OVERHEAD = 80_000   # Aave overhead


@dataclass
class ArbOpportunity:
    """Describes a profitable flash loan arbitrage."""
    token_in:       str
    token_out:      str
    borrow_amount:  int          # raw units of token_in
    buy_quote:      Quote        # token_in → token_out (buy leg)
    sell_quote:     Quote        # token_out → token_in (sell leg)
    flash_fee:      int          # raw units of token_in
    gas_cost_token: int          # gas cost converted to token_in units
    gross_profit:   int          # sell_out - borrow_amount - flash_fee
    net_profit:     int          # gross_profit - gas_cost_token
    net_profit_usd: float        # net profit in USD
    edge_pct:       float        # net_profit / borrow_amount
    label:          str = ""


def _aave_flash_fee(amount: int) -> int:
    """Compute Aave V3 flash loan fee for `amount` (rounds up)."""
    return (amount * AAVE_FEE_NUMERATOR + AAVE_FEE_DENOMINATOR - 1) // AAVE_FEE_DENOMINATOR


async def estimate_gas_cost_wei(w3: Web3, fee_history_blocks: int = 3) -> int:
    """Estimate gas price on Base (tip + base fee)."""
    try:
        history = await w3.eth.fee_history(fee_history_blocks, "latest", [50])
        base_fee = history["baseFeePerGas"][-1]
        tips = [r[0] for r in history["reward"] if r]
        tip = max(tips) if tips else 0
        return base_fee + tip
    except Exception:
        # Base mainnet gas is typically < 0.01 gwei when uncongested
        return Web3.to_wei(0.005, "gwei")


def raw_to_usd(amount_raw: int, decimals: int, price_usd: float) -> float:
    return (amount_raw / 10**decimals) * price_usd


def check_arb(
    token_in:      str,
    token_out:     str,
    borrow_amount: int,
    buy_quote:     Quote,   # token_in → token_out  (best price to buy token_out)
    sell_quote:    Quote,   # token_out → token_in  (best price to sell token_out)
    gas_price_wei: int,
    token_in_decimals: int = 6,
    token_in_usd_price: float = 1.0,  # USDC ≈ $1
) -> Optional[ArbOpportunity]:
    """
    Check if a round-trip arb is profitable.

    Flow:
      1. Borrow `borrow_amount` of token_in via Aave flash loan
      2. Buy  `buy_quote.amount_out` of token_out   (buy leg)
      3. Sell `buy_quote.amount_out` of token_out  → token_in  (sell leg)
      4. Repay borrow_amount + flash_fee
      5. Keep profit
    """
    flash_fee = _aave_flash_fee(borrow_amount)
    total_owed = borrow_amount + flash_fee

    # sell_out is what we receive after the full round-trip
    sell_out = sell_quote.amount_out

    if sell_out <= total_owed:
        return None  # not profitable after flash fee

    gross_profit = sell_out - total_owed

    # Gas cost estimate
    total_gas = GAS_PER_SWAP * 2 + FLASH_LOAN_OVERHEAD
    gas_cost_wei = total_gas * gas_price_wei
    # Convert ETH gas cost to token_in units (approximate: ETH price * gas in ETH / token price)
    # For simplicity, estimate 0.0001 ETH per successful arb on Base ≈ $0.20 at $2000 ETH
    # We subtract a fixed buffer. Production: fetch real ETH/USD price.
    gas_cost_token_approx = int(0.0001e18 / 1e12 / token_in_usd_price * (10 ** token_in_decimals))

    net_profit = gross_profit - gas_cost_token_approx

    if net_profit <= 0:
        return None

    net_profit_usd = raw_to_usd(net_profit, token_in_decimals, token_in_usd_price)

    if net_profit_usd < config.MIN_PROFIT_USD:
        log.debug(
            "Arb below MIN_PROFIT_USD: %.4f < %.2f  (%s→%s)",
            net_profit_usd, config.MIN_PROFIT_USD, buy_quote.dex, sell_quote.dex,
        )
        return None

    edge_pct = net_profit / borrow_amount

    label = f"{buy_quote.dex} → {sell_quote.dex}"

    return ArbOpportunity(
        token_in=token_in,
        token_out=token_out,
        borrow_amount=borrow_amount,
        buy_quote=buy_quote,
        sell_quote=sell_quote,
        flash_fee=flash_fee,
        gas_cost_token=gas_cost_token_approx,
        gross_profit=gross_profit,
        net_profit=net_profit,
        net_profit_usd=net_profit_usd,
        edge_pct=edge_pct,
        label=label,
    )
