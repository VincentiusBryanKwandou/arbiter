"""Chain constants and addresses for Base mainnet flash loan arbitrage."""

from __future__ import annotations
import os

# ── RPC ──────────────────────────────────────────────────────────────────────
BASE_RPC_URL: str = os.getenv("BASE_RPC_URL", "https://mainnet.base.org")

# ── Chain ────────────────────────────────────────────────────────────────────
CHAIN_ID = 8453

# ── Aave V3 on Base ──────────────────────────────────────────────────────────
AAVE_POOL_ADDRESSES_PROVIDER = "0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64b"
AAVE_POOL                    = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5"

# ── Uniswap V3 on Base ───────────────────────────────────────────────────────
UNISWAP_V3_ROUTER  = "0x2626664c2603336E57B271c5C0b26F421741e481"  # SwapRouter02
UNISWAP_V3_QUOTER  = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a"  # QuoterV2
UNISWAP_V3_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD"

# ── Aerodrome on Base ─────────────────────────────────────────────────────────
AERODROME_ROUTER  = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43"
AERODROME_FACTORY = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da"

# ── Flash Arb Contract ────────────────────────────────────────────────────────
FLASH_ARB_CONTRACT = os.getenv("FLASH_ARB_CONTRACT", "")

# ── Tokens on Base ───────────────────────────────────────────────────────────
WETH  = "0x4200000000000000000000000000000000000006"
USDC  = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
cbETH = "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22"
cbBTC = "0xcbB7C0000ab88B473b1f5aFd9ef808440eed33Bf"
DAI   = "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb"
USDbC = "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA"  # bridged USDC (legacy)

# ── Uniswap V3 fee tiers (in 1/1,000,000 units) ──────────────────────────────
FEE_LOWEST = 100    # 0.01%
FEE_LOW    = 500    # 0.05%
FEE_MEDIUM = 3000   # 0.30%
FEE_HIGH   = 10000  # 1.00%

# ── Scan configuration ────────────────────────────────────────────────────────
# Pairs to monitor. Each tuple: (tokenIn, tokenOut, borrow_amount, label)
# borrow_amount is in the smallest unit of tokenIn
SCAN_PAIRS: list[tuple[str, str, int, str]] = [
    (USDC,  WETH,  10_000_000_000, "USDC→WETH"),   # borrow 10,000 USDC (6 dec)
    (WETH,  USDC,  1_000_000_000_000_000_000, "WETH→USDC"),  # borrow 1 WETH (18 dec)
    (USDC,  cbETH, 10_000_000_000, "USDC→cbETH"),
    (USDC,  DAI,   10_000_000_000, "USDC→DAI"),
]

# ── Bot settings ──────────────────────────────────────────────────────────────
MIN_PROFIT_USD    = float(os.getenv("MIN_PROFIT_USD", "5.0"))   # ignore < $5 profit
SCAN_INTERVAL_SEC = int(os.getenv("FLASH_SCAN_INTERVAL", "30"))  # scan every 30s
MAX_GAS_GWEI      = float(os.getenv("MAX_GAS_GWEI", "0.01"))    # Base is very cheap

# Aave V3 flash loan fee = 5 bps (0.05%)
AAVE_FLASH_FEE_BPS = 5
