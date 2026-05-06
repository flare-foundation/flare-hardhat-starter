// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title  MorphoMarketShim
/// @notice Slim wrapper around a single Morpho Blue market, sized so a Flare
///         smart-account memo-field instruction can drive a full
///         open/close cycle within the XRPL per-memo 1024-byte limit.
///
///         A direct Morpho Blue call carries the 5-field MarketParams tuple
///         (160 bytes ABI-encoded) inline. Wrapped in `executeUserOp([Call])`
///         and the PackedUserOperation tuple, the encoded payload comes out to
///         ~1034 bytes — over the 1024-byte cap. This contract pins
///         MarketParams in immutable state at deploy time and bundles two
///         Morpho ops per shim call, so a single memo opens or closes a full
///         position (each individual Morpho op alone runs ~842 bytes; two
///         loose ops in one memo would exceed 1024 anyway).
///
/// ### Caller flow (from a Flare personal smart account):
///   1. One-time setup memos: smart account approves the shim for both
///      tokens and calls `morpho.setAuthorization(shim, true)`.
///   2. Open-position memo: `shim.supplyAndBorrow(collateralAssets,
///      borrowAssets, borrowReceiver)`.
///   3. Close-position memo: `shim.repayAndWithdrawCollateral(repayShares,
///      withdrawAssets, collateralReceiver)`.
///
///         Both shim entry points resolve `onBehalf` to msg.sender, so the
///         position stays attributed to the smart account.

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

struct MarketParams {
    address loanToken;
    address collateralToken;
    address oracle;
    address irm;
    uint256 lltv;
}

interface IMorpho {
    function supplyCollateral(
        MarketParams memory marketParams,
        uint256 assets,
        address onBehalf,
        bytes calldata data
    ) external;

    function borrow(
        MarketParams memory marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        address receiver
    ) external returns (uint256, uint256);

    function repay(
        MarketParams memory marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        bytes calldata data
    ) external returns (uint256, uint256);

    function withdrawCollateral(
        MarketParams memory marketParams,
        uint256 assets,
        address onBehalf,
        address receiver
    ) external;
}

contract MorphoMarketShim {
    IMorpho public immutable morpho;
    address public immutable loanToken;
    address public immutable collateralToken;
    address public immutable oracle;
    address public immutable irm;
    uint256 public immutable lltv;

    error TransferFromFailed();
    error ApproveFailed();
    error UnauthorizedCallback();

    constructor(address _morpho, MarketParams memory params) {
        morpho = IMorpho(_morpho);
        loanToken = params.loanToken;
        collateralToken = params.collateralToken;
        oracle = params.oracle;
        irm = params.irm;
        lltv = params.lltv;

        // Pre-approve Morpho to pull both tokens from the shim. The shim never
        // custodies funds across calls — these allowances exist only to let
        // Morpho settle each operation atomically.
        if (!IERC20(params.loanToken).approve(_morpho, type(uint256).max)) revert ApproveFailed();
        if (!IERC20(params.collateralToken).approve(_morpho, type(uint256).max)) revert ApproveFailed();
    }

    /// @notice Supply collateral and borrow in one shim call, both on behalf
    ///         of msg.sender. Loan tokens go to `borrowReceiver`. Caller must
    ///         have approved the shim for `collateralAssets` of the collateral
    ///         token and have authorized the shim on Morpho.
    function supplyAndBorrow(
        uint256 collateralAssets,
        uint256 borrowAssets,
        address borrowReceiver
    ) external returns (uint256 assetsBorrowed, uint256 sharesBorrowed) {
        if (!IERC20(collateralToken).transferFrom(msg.sender, address(this), collateralAssets))
            revert TransferFromFailed();
        MarketParams memory p = _params();
        morpho.supplyCollateral(p, collateralAssets, msg.sender, "");
        return morpho.borrow(p, borrowAssets, 0, msg.sender, borrowReceiver);
    }

    /// @notice Repay (share-denominated) and withdraw collateral in one shim
    ///         call. Mirrors `supplyAndBorrow` for the position-closing step.
    ///         Caller must have approved the shim for the loan token and have
    ///         authorized the shim on Morpho.
    function repayAndWithdrawCollateral(
        uint256 repayShares,
        uint256 withdrawAssets,
        address collateralReceiver
    ) external returns (uint256 assetsRepaid, uint256 sharesRepaid) {
        MarketParams memory p = _params();
        (assetsRepaid, sharesRepaid) = morpho.repay(p, 0, repayShares, msg.sender, abi.encode(msg.sender));
        morpho.withdrawCollateral(p, withdrawAssets, msg.sender, collateralReceiver);
    }

    /// @notice Morpho calls this during a share-denominated repay so the shim
    ///         can pull the resolved asset amount from the original payer.
    function onMorphoRepay(uint256 assets, bytes calldata data) external {
        if (msg.sender != address(morpho)) revert UnauthorizedCallback();
        address payer = abi.decode(data, (address));
        if (!IERC20(loanToken).transferFrom(payer, address(this), assets)) revert TransferFromFailed();
    }

    function _params() internal view returns (MarketParams memory) {
        return
            MarketParams({
                loanToken: loanToken,
                collateralToken: collateralToken,
                oracle: oracle,
                irm: irm,
                lltv: lltv
            });
    }
}
