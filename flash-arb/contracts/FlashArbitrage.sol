// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────────────────────
//  FlashArbitrage — Arbiter v1
//  Flash-loan from Aave V3, execute two generic DEX swaps, repay + keep profit.
//
//  Supported on Base mainnet:
//    • Buy leg  — Uniswap V3 exactInput  OR  Aerodrome swapExactTokensForTokens
//    • Sell leg — same options
//
//  Security model:
//    • Router whitelist — only pre-approved DEX routers can be called
//    • onlyOwner execution — only deployer triggers flash loans
//    • Minimum profit guard — reverts if net profit < minProfitUSD after repay
//    • Emergency pause — owner can halt without redeployment
// ─────────────────────────────────────────────────────────────────────────────

interface IPoolAddressesProvider {
    function getPool() external view returns (address);
}

interface IPool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract FlashArbitrage {
    // ── State ────────────────────────────────────────────────────────────────
    address public owner;
    bool    public paused;

    IPool   public immutable POOL;
    IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;

    /// @dev Only whitelisted routers may receive token approvals
    mapping(address => bool) public approvedRouters;

    // ── Events ───────────────────────────────────────────────────────────────
    event ArbitrageExecuted(
        address indexed asset,
        uint256 borrowed,
        uint256 flashFee,
        uint256 profit,
        uint256 timestamp
    );
    event RouterAdded(address indexed router);
    event RouterRemoved(address indexed router);
    event EmergencyWithdraw(address indexed token, uint256 amount);

    // ── Errors ───────────────────────────────────────────────────────────────
    error Unauthorized();
    error ContractPaused();
    error RouterNotApproved(address router);
    error InsufficientProfit(uint256 received, uint256 needed);
    error SwapFailed(uint8 leg);
    error ZeroAddress();

    // ── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier notPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────
    constructor(address _addressesProvider) {
        if (_addressesProvider == address(0)) revert ZeroAddress();
        ADDRESSES_PROVIDER = IPoolAddressesProvider(_addressesProvider);
        POOL = IPool(IPoolAddressesProvider(_addressesProvider).getPool());
        owner = msg.sender;
    }

    // ── Flash Loan Entry Point ────────────────────────────────────────────────
    /**
     * @notice Borrow `amount` of `asset` via Aave V3 flash loan, run 2-leg arb,
     *         repay, keep profit.
     *
     * @param asset        Token to borrow (e.g. USDC on Base)
     * @param amount       Amount to borrow (in asset decimals)
     * @param router1      DEX router for buy leg (must be in approvedRouters)
     * @param calldata1    Pre-encoded call to router1 (exactInput / swapExact…)
     * @param router2      DEX router for sell leg
     * @param calldata2    Pre-encoded call to router2
     * @param minProfit    Minimum net profit in asset tokens (slippage guard)
     */
    function startArbitrage(
        address asset,
        uint256 amount,
        address router1,
        bytes   calldata calldata1,
        address router2,
        bytes   calldata calldata2,
        uint256 minProfit
    ) external onlyOwner notPaused {
        if (!approvedRouters[router1]) revert RouterNotApproved(router1);
        if (!approvedRouters[router2]) revert RouterNotApproved(router2);

        bytes memory params = abi.encode(
            asset, router1, calldata1, router2, calldata2, minProfit
        );
        POOL.flashLoanSimple(address(this), asset, amount, params, 0);
    }

    // ── Aave V3 Callback ─────────────────────────────────────────────────────
    /**
     * @dev Called by Aave pool after transferring `amount` of `asset` to this contract.
     *      Must repay `amount + premium` before returning true.
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        // Only Aave pool can call this, and only after we initiated the flash loan
        if (msg.sender != address(POOL))     revert Unauthorized();
        if (initiator  != address(this))     revert Unauthorized();

        (
            address _asset,
            address router1,
            bytes memory calldata1,
            address router2,
            bytes memory calldata2,
            uint256 minProfit
        ) = abi.decode(params, (address, address, bytes, address, bytes, uint256));

        uint256 totalOwed = amount + premium;

        // ── Leg 1: buy ──────────────────────────────────────────────────────
        IERC20(_asset).approve(router1, amount);
        (bool ok1, ) = router1.call(calldata1);
        if (!ok1) revert SwapFailed(1);

        // ── Leg 2: sell ─────────────────────────────────────────────────────
        // Router2 gets whatever balance of intermediate token we hold now.
        // The encoded calldata already specifies which token + amount to swap.
        (bool ok2, ) = router2.call(calldata2);
        if (!ok2) revert SwapFailed(2);

        // ── Profit check ────────────────────────────────────────────────────
        uint256 received = IERC20(_asset).balanceOf(address(this));
        if (received < totalOwed + minProfit)
            revert InsufficientProfit(received, totalOwed + minProfit);

        uint256 profit = received - totalOwed;

        // ── Repay Aave ──────────────────────────────────────────────────────
        IERC20(_asset).approve(address(POOL), totalOwed);

        emit ArbitrageExecuted(_asset, amount, premium, profit, block.timestamp);
        return true;
    }

    // ── Admin ────────────────────────────────────────────────────────────────
    function addRouter(address router) external onlyOwner {
        if (router == address(0)) revert ZeroAddress();
        approvedRouters[router] = true;
        emit RouterAdded(router);
    }

    function removeRouter(address router) external onlyOwner {
        approvedRouters[router] = false;
        emit RouterRemoved(router);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    /// @dev Withdraw any ERC20 profit that accumulated in this contract
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
        emit EmergencyWithdraw(token, amount);
    }

    function withdrawETH() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {}
}
