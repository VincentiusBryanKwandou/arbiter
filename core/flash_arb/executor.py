"""Flash loan executor — builds and sends the on-chain transaction.

Security:
  - Private key only ever in memory (from env var), never logged
  - Dry-run mode (no tx sent) when FLASH_ARB_DRY_RUN=1
  - minProfit passed to contract as final safety net
"""

from __future__ import annotations

import logging
import os
import time
from typing import Optional

from eth_abi import encode as abi_encode
from web3 import AsyncWeb3
from web3.providers import AsyncHTTPProvider

from core.flash_arb import config
from core.flash_arb.abis import FLASH_ARB_ABI, SWAP_ROUTER_ABI, AERODROME_ROUTER_ABI
from core.flash_arb.calculator import ArbOpportunity

log = logging.getLogger(__name__)

DRY_RUN = os.getenv("FLASH_ARB_DRY_RUN", "1") == "1"  # safe default: dry run

# ── Path encoding helpers ─────────────────────────────────────────────────────

def encode_v3_path(tokens: list[str], fees: list[int]) -> bytes:
    """Pack Uniswap V3 multi-hop path: addr(20) | fee(3) | addr(20) | ..."""
    assert len(tokens) == len(fees) + 1
    result = bytes.fromhex(tokens[0][2:])
    for fee, tok in zip(fees, tokens[1:]):
        result += fee.to_bytes(3, "big")
        result += bytes.fromhex(tok[2:])
    return result


def encode_v3_exact_input(
    path_bytes: bytes,
    recipient: str,
    amount_in: int,
    amount_out_min: int,
) -> bytes:
    """ABI-encode exactInput(params) call for Uniswap V3 SwapRouter02."""
    from eth_abi import encode as abi_encode
    # Function selector for exactInput((bytes,address,uint256,uint256))
    selector = bytes.fromhex("b858183f")
    encoded = abi_encode(
        ["(bytes,address,uint256,uint256)"],
        [(path_bytes, recipient, amount_in, amount_out_min)],
    )
    return selector + encoded


def encode_aerodrome_swap(
    amount_in: int,
    amount_out_min: int,
    token_from: str,
    token_to: str,
    stable: bool,
    recipient: str,
    deadline: int,
) -> bytes:
    """ABI-encode swapExactTokensForTokens call for Aerodrome."""
    selector = bytes.fromhex("e8e33700")  # swapExactTokensForTokens(uint256,uint256,(address,address,bool,address)[],address,uint256)
    routes = [(
        bytes.fromhex(token_from[2:].zfill(40)),
        bytes.fromhex(token_to[2:].zfill(40)),
        stable,
        bytes.fromhex(config.AERODROME_FACTORY[2:].zfill(40)),
    )]
    encoded = abi_encode(
        ["uint256", "uint256", "(address,address,bool,address)[]", "address", "uint256"],
        [amount_in, amount_out_min, routes, recipient, deadline],
    )
    return selector + encoded


def encode_approve(spender: str, amount: int) -> bytes:
    """ABI-encode ERC20.approve(spender, amount)."""
    selector = bytes.fromhex("095ea7b3")
    encoded = abi_encode(["address", "uint256"], [spender, amount])
    return selector + encoded


# ── Executor ─────────────────────────────────────────────────────────────────

class FlashArbExecutor:
    """Builds and broadcasts flash arb transactions to Base mainnet."""

    def __init__(self) -> None:
        self._w3 = AsyncWeb3(AsyncHTTPProvider(config.BASE_RPC_URL))
        self._contract_addr = config.FLASH_ARB_CONTRACT
        if self._contract_addr:
            self._contract = self._w3.eth.contract(
                address=self._w3.to_checksum_address(self._contract_addr),
                abi=FLASH_ARB_ABI,
            )
        else:
            self._contract = None
        self._pk = os.getenv("DEPLOYER_PRIVATE_KEY", "")
        if self._pk and not self._pk.startswith("0x"):
            self._pk = "0x" + self._pk

    def _build_leg_calldata(self, opp: ArbOpportunity, leg: int) -> bytes:
        """
        Build encoded calldata for leg 1 (buy) or leg 2 (sell).

        For Uniswap V3 legs: exactInput
        For Aerodrome legs: swapExactTokensForTokens

        The contract address is the recipient — profits accumulate there.
        """
        quote = opp.buy_quote if leg == 1 else opp.sell_quote
        recipient = self._contract_addr
        deadline = int(time.time()) + 300  # 5 min

        if quote.dex.startswith("uniswap_v3"):
            fee_str = quote.dex.split("_")[-1]
            fee = int(fee_str)
            if leg == 1:
                path = encode_v3_path([opp.token_in, opp.token_out], [fee])
                amount_in = opp.borrow_amount
                amount_out_min = 1  # strict check only on final leg
            else:
                path = encode_v3_path([opp.token_out, opp.token_in], [fee])
                amount_in = opp.buy_quote.amount_out
                amount_out_min = opp.borrow_amount + opp.flash_fee + opp.net_profit // 2  # 50% of expected profit as floor
            return encode_v3_exact_input(path, recipient, amount_in, amount_out_min)

        elif quote.dex.startswith("aerodrome"):
            stable = "stable" in quote.dex
            if leg == 1:
                return encode_aerodrome_swap(
                    opp.borrow_amount, 1,
                    opp.token_in, opp.token_out,
                    stable, recipient, deadline,
                )
            else:
                min_out = opp.borrow_amount + opp.flash_fee
                return encode_aerodrome_swap(
                    opp.buy_quote.amount_out, min_out,
                    opp.token_out, opp.token_in,
                    stable, recipient, deadline,
                )

        raise ValueError(f"Unknown DEX type: {quote.dex}")

    def _get_router(self, dex: str) -> str:
        if dex.startswith("uniswap_v3"):
            return config.UNISWAP_V3_ROUTER
        elif dex.startswith("aerodrome"):
            return config.AERODROME_ROUTER
        raise ValueError(f"Unknown DEX: {dex}")

    async def execute(self, opp: ArbOpportunity) -> Optional[str]:
        """
        Send the flash arb transaction. Returns tx hash or None on dry run / error.

        Dry run mode (FLASH_ARB_DRY_RUN=1) simulates without sending.
        """
        if not self._contract or not self._contract_addr:
            log.error("FLASH_ARB_CONTRACT not configured — set env var after deploy")
            return None

        router1 = self._get_router(opp.buy_quote.dex)
        router2 = self._get_router(opp.sell_quote.dex)
        cd1     = self._build_leg_calldata(opp, 1)
        cd2     = self._build_leg_calldata(opp, 2)

        # min_profit: 50% of calculated net profit in raw token units
        min_profit = opp.net_profit // 2

        log.info(
            "🔥 ARB FOUND | %s | borrow=%d | est net=+%.4f USD | edge=%.4f%%",
            opp.label, opp.borrow_amount, opp.net_profit_usd, opp.edge_pct * 100,
        )

        if DRY_RUN:
            log.info("DRY RUN — transaction NOT sent (set FLASH_ARB_DRY_RUN=0 to execute)")
            return "dry_run"

        if not self._pk or self._pk == "0x":
            log.error("DEPLOYER_PRIVATE_KEY not set — cannot sign transaction")
            return None

        try:
            acct = self._w3.eth.account.from_key(self._pk)
            nonce = await self._w3.eth.get_transaction_count(acct.address)
            gas_price = await self._w3.eth.gas_price

            tx = await self._contract.functions.startArbitrage(
                self._w3.to_checksum_address(opp.token_in),
                opp.borrow_amount,
                self._w3.to_checksum_address(router1),
                cd1,
                self._w3.to_checksum_address(router2),
                cd2,
                min_profit,
            ).build_transaction({
                "from":     acct.address,
                "nonce":    nonce,
                "gasPrice": int(gas_price * 1.1),  # 10% tip
                "gas":      600_000,
            })

            signed = acct.sign_transaction(tx)
            tx_hash = await self._w3.eth.send_raw_transaction(signed.raw_transaction)
            tx_hex = tx_hash.hex()
            log.info("✅ TX sent: %s", tx_hex)
            receipt = await self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
            if receipt["status"] == 1:
                log.info("✅ TX confirmed | block=%s | gas=%s", receipt["blockNumber"], receipt["gasUsed"])
            else:
                log.error("❌ TX reverted | block=%s", receipt["blockNumber"])
            return tx_hex

        except Exception as e:
            log.exception("Failed to send flash arb tx: %s", e)
            return None
