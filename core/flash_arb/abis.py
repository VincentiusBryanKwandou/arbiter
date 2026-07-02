"""Minimal ABIs for flash arb on-chain reads."""

# ── Uniswap V3 QuoterV2 ──────────────────────────────────────────────────────
QUOTER_V2_ABI = [
    {
        "inputs": [
            {
                "components": [
                    {"internalType": "bytes",   "name": "path",             "type": "bytes"},
                    {"internalType": "uint256", "name": "amountIn",         "type": "uint256"},
                ],
                "internalType": "struct IQuoterV2.QuoteExactInputParams",
                "name": "params",
                "type": "tuple",
            }
        ],
        "name": "quoteExactInput",
        "outputs": [
            {"internalType": "uint256",   "name": "amountOut",              "type": "uint256"},
            {"internalType": "uint160[]", "name": "sqrtPriceX96AfterList",  "type": "uint160[]"},
            {"internalType": "uint32[]",  "name": "initializedTicksCrossedList", "type": "uint32[]"},
            {"internalType": "uint256",   "name": "gasEstimate",            "type": "uint256"},
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "tokenIn",  "type": "address"},
            {"internalType": "address", "name": "tokenOut", "type": "address"},
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "uint24",  "name": "fee",      "type": "uint24"},
            {"internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160"},
        ],
        "name": "quoteExactInputSingle",
        "outputs": [
            {"internalType": "uint256",  "name": "amountOut",             "type": "uint256"},
            {"internalType": "uint160",  "name": "sqrtPriceX96After",     "type": "uint160"},
            {"internalType": "uint32",   "name": "initializedTicksCrossed","type": "uint32"},
            {"internalType": "uint256",  "name": "gasEstimate",           "type": "uint256"},
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]

# ── Uniswap V3 SwapRouter02 ──────────────────────────────────────────────────
SWAP_ROUTER_ABI = [
    {
        "inputs": [
            {
                "components": [
                    {"internalType": "bytes",   "name": "path",             "type": "bytes"},
                    {"internalType": "address", "name": "recipient",        "type": "address"},
                    {"internalType": "uint256", "name": "amountIn",         "type": "uint256"},
                    {"internalType": "uint256", "name": "amountOutMinimum", "type": "uint256"},
                ],
                "internalType": "struct IV3SwapRouter.ExactInputParams",
                "name": "params",
                "type": "tuple",
            }
        ],
        "name": "exactInput",
        "outputs": [{"internalType": "uint256", "name": "amountOut", "type": "uint256"}],
        "stateMutability": "payable",
        "type": "function",
    },
]

# ── Aerodrome Router ─────────────────────────────────────────────────────────
AERODROME_ROUTER_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn",   "type": "uint256"},
            {
                "components": [
                    {"internalType": "address", "name": "from",    "type": "address"},
                    {"internalType": "address", "name": "to",      "type": "address"},
                    {"internalType": "bool",    "name": "stable",  "type": "bool"},
                    {"internalType": "address", "name": "factory", "type": "address"},
                ],
                "internalType": "struct IRouter.Route[]",
                "name": "routes",
                "type": "tuple[]",
            },
        ],
        "name": "getAmountsOut",
        "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn",    "type": "uint256"},
            {"internalType": "uint256", "name": "amountOutMin","type": "uint256"},
            {
                "components": [
                    {"internalType": "address", "name": "from",    "type": "address"},
                    {"internalType": "address", "name": "to",      "type": "address"},
                    {"internalType": "bool",    "name": "stable",  "type": "bool"},
                    {"internalType": "address", "name": "factory", "type": "address"},
                ],
                "internalType": "struct IRouter.Route[]",
                "name": "routes",
                "type": "tuple[]",
            },
            {"internalType": "address", "name": "to",       "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
        ],
        "name": "swapExactTokensForTokens",
        "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]

# ── ERC20 (minimal) ───────────────────────────────────────────────────────────
ERC20_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# ── FlashArbitrage contract ───────────────────────────────────────────────────
FLASH_ARB_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "asset",      "type": "address"},
            {"internalType": "uint256", "name": "amount",     "type": "uint256"},
            {"internalType": "address", "name": "router1",    "type": "address"},
            {"internalType": "bytes",   "name": "calldata1",  "type": "bytes"},
            {"internalType": "address", "name": "router2",    "type": "address"},
            {"internalType": "bytes",   "name": "calldata2",  "type": "bytes"},
            {"internalType": "uint256", "name": "minProfit",  "type": "uint256"},
        ],
        "name": "startArbitrage",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "token",  "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
        ],
        "name": "withdrawToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs":  [{"internalType": "bool", "name": "_paused", "type": "bool"}],
        "name":    "setPaused",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True,  "name": "asset",     "type": "address"},
            {"indexed": False, "name": "borrowed",  "type": "uint256"},
            {"indexed": False, "name": "flashFee",  "type": "uint256"},
            {"indexed": False, "name": "profit",    "type": "uint256"},
            {"indexed": False, "name": "timestamp", "type": "uint256"},
        ],
        "name": "ArbitrageExecuted",
        "type": "event",
    },
]
