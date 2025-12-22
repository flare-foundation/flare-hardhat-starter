// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IFirelightVault
 * @notice Minimal external interface for interacting with FirelightVault.
 *
 * @dev Mirrors the public/external surface (including custom delayed withdrawals)
 * so off-chain scripts (Hardhat/TypeChain) and on-chain integrators can call it.
 */
interface IFirelightVault {
    // --- Types ---

    /**
     * @notice Initial parameters needed for the vault's deployment.
     */
    struct InitParams {
        address defaultAdmin;
        address limitUpdater;
        address blocklister;
        address pauser;
        address periodConfigurationUpdater;
        address rescuer;
        uint256 depositLimit;
        uint48 periodConfigurationDuration;
    }

    /**
     * @notice Period configuration used for delayed withdrawal periods.
     */
    struct PeriodConfiguration {
        uint48 epoch;
        uint48 duration;
        uint256 startingPeriod;
    }

    // --- Events ---

    event DepositLimitUpdated(uint256 limit);
    event PeriodConfigurationAdded(PeriodConfiguration periodConfiguration);

    event WithdrawRequest(
        address indexed sender,
        address indexed receiver,
        address indexed owner,
        uint256 period,
        uint256 assets,
        uint256 shares
    );

    event CompleteWithdraw(address indexed receiver, uint256 assets, uint256 period);

    event SharesRescuedFromBlocklisted(address from, address to, uint256 rescuedShares);

    event WithdrawRescuedFromBlocklisted(address from, address to, uint256[] periods, uint256[] rescuedShares);

    // --- Initialization ---

    function initialize(IERC20 _asset, string memory _name, string memory _symbol, bytes memory _initParams) external;

    // --- ERC4626 / ERC20 essentials commonly used by scripts ---

    function asset() external view returns (address);

    function totalAssets() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function convertToShares(uint256 assets) external view returns (uint256);

    function convertToAssets(uint256 shares) external view returns (uint256);

    function maxDeposit(address receiver) external view returns (uint256);

    function maxMint(address receiver) external view returns (uint256);

    function maxWithdraw(address owner) external view returns (uint256);

    function maxRedeem(address owner) external view returns (uint256);

    function previewMint(uint256 shares) external view returns (uint256);

    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    function mint(uint256 shares, address receiver) external returns (uint256 assets);

    /**
     * @notice Custom: creates a withdrawal request (no immediate asset transfer).
     */
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);

    /**
     * @notice Custom: creates a withdrawal request (no immediate asset transfer).
     */
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    function approve(address spender, uint256 amount) external returns (bool);

    // --- Custom delayed-withdrawal flow ---

    function claimWithdraw(uint256 period) external returns (uint256 assets);

    function withdrawalsOf(uint256 period, address account) external view returns (uint256);

    // --- Period configuration / time helpers ---

    function periodConfigurationAtTimestamp(uint48 timestamp) external view returns (PeriodConfiguration memory);

    function periodConfigurationAtNumber(uint256 periodNumber) external view returns (PeriodConfiguration memory);

    function periodAtTimestamp(uint48 timestamp) external view returns (uint256);

    function currentPeriodConfiguration() external view returns (PeriodConfiguration memory);

    function currentPeriod() external view returns (uint256);

    function currentPeriodStart() external view returns (uint48);

    function currentPeriodEnd() external view returns (uint48);

    function nextPeriodEnd() external view returns (uint48);

    function periodConfigurationsLength() external view returns (uint256);

    // --- Admin ops (optional, but useful for scripts) ---

    function pause() external;

    function unpause() external;

    function updateDepositLimit(uint256 newLimit) external;

    function addPeriodConfiguration(uint48 epoch, uint48 duration) external;

    function addToBlocklist(address account) external;

    function removeFromBlocklist(address account) external;

    function rescueSharesFromBlocklisted(address from, address to) external;

    function rescueWithdrawFromBlocklisted(address from, address to, uint256[] calldata periods) external;
}
