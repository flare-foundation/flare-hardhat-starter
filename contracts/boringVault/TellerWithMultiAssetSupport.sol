// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "solady/src/tokens/ERC20.sol";
import {WETH} from "solady/src/tokens/WETH.sol";
import {BoringVault} from "./BoringVault.sol";
import {AccountantWithRateProviders} from "./AccountantWithRateProviders.sol";
import {FixedPointMathLib} from "solady/src/utils/FixedPointMathLib.sol";
import {SafeTransferLib} from "solady/src/utils/SafeTransferLib.sol";
import {IBeforeTransferHook} from "./interfaces/IBeforeTransferHook.sol";
import {Ownable} from "solady/src/auth/Ownable.sol";
import {ReentrancyGuard} from "solady/src/utils/ReentrancyGuard.sol";
import {IPausable} from "./interfaces/IPausable.sol";

contract TellerWithMultiAssetSupport is
    Ownable,
    IBeforeTransferHook,
    ReentrancyGuard,
    IPausable
{
    // ========================================= STRUCTS =========================================
    /**
     * @param allowDeposits bool indicating whether or not deposits are allowed for this asset.
     * @param allowWithdraws bool indicating whether or not withdraws are allowed for this asset.
     * @param sharePremium uint16 indicating the premium to apply to the shares minted.
     *        where 40 represents a 40bps reduction in shares minted using this asset.
     */
    struct Asset {
        bool allowDeposits;
        bool allowWithdraws;
        uint16 sharePremium;
    }

    // ========================================= CONSTANTS =========================================

    /**
     * @notice Native address used to tell the contract to handle native asset deposits.
     */
    address internal constant NATIVE =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /**
     * @notice The maximum possible share lock period.
     */
    uint256 internal constant MAX_SHARE_LOCK_PERIOD = 3 days;

    /**
     * @notice The maximum possible share premium that can be set using `updateAssetData`.
     * @dev 1,000 or 10%
     */
    uint16 internal constant MAX_SHARE_PREMIUM = 1_000;

    // ========================================= STATE =========================================

    /**
     * @notice Mapping ERC20s to their assetData.
     */
    mapping(ERC20 => Asset) public assetData;

    /**
     * @notice The deposit nonce used to map to a deposit hash.
     */
    uint96 public depositNonce;

    /**
     * @notice After deposits, shares are locked to the msg.sender's address
     *         for `shareLockPeriod`.
     * @dev During this time all trasnfers from msg.sender will revert, and
     *      deposits are refundable.
     */
    uint64 public shareLockPeriod;

    /**
     * @notice Used to pause calls to `deposit` and `depositWithPermit`.
     */
    bool public isPaused;

    /**
     * @dev Maps deposit nonce to keccak256(address receiver, address depositAsset, uint256 depositAmount, uint256 shareAmount, uint256 timestamp, uint256 shareLockPeriod).
     */
    mapping(uint256 => bytes32) public publicDepositHistory;

    /**
     * @notice Maps user address to the time their shares will be unlocked.
     */
    mapping(address => uint256) public shareUnlockTime;

    /**
     * @notice Mapping `from` address to a bool to deny them from transferring shares.
     */
    mapping(address => bool) public fromDenyList;

    /**
     * @notice Mapping `to` address to a bool to deny them from receiving shares.
     */
    mapping(address => bool) public toDenyList;

    /**
     * @notice Mapping `opeartor` address to a bool to deny them from calling `transfer` or `transferFrom`.
     */
    mapping(address => bool) public operatorDenyList;

    //============================== ERRORS ===============================

    error TellerWithMultiAssetSupport__ShareLockPeriodTooLong();
    error TellerWithMultiAssetSupport__SharesAreLocked();
    error TellerWithMultiAssetSupport__SharesAreUnLocked();
    error TellerWithMultiAssetSupport__BadDepositHash();
    error TellerWithMultiAssetSupport__AssetNotSupported();
    error TellerWithMultiAssetSupport__ZeroAssets();
    error TellerWithMultiAssetSupport__MinimumMintNotMet();
    error TellerWithMultiAssetSupport__MinimumAssetsNotMet();
    error TellerWithMultiAssetSupport__PermitFailedAndAllowanceTooLow();
    error TellerWithMultiAssetSupport__ZeroShares();
    error TellerWithMultiAssetSupport__DualDeposit();
    error TellerWithMultiAssetSupport__Paused();
    error TellerWithMultiAssetSupport__TransferDenied(
        address from,
        address to,
        address operator
    );
    error TellerWithMultiAssetSupport__SharePremiumTooLarge();
    error TellerWithMultiAssetSupport__CannotDepositNative();

    //============================== EVENTS ===============================

    event Paused();
    event Unpaused();
    event AssetDataUpdated(
        address indexed asset,
        bool allowDeposits,
        bool allowWithdraws,
        uint16 sharePremium
    );
    event Deposit(
        uint256 indexed nonce,
        address indexed receiver,
        address indexed depositAsset,
        uint256 depositAmount,
        uint256 shareAmount,
        uint256 depositTimestamp,
        uint256 shareLockPeriodAtTimeOfDeposit
    );
    event BulkDeposit(address indexed asset, uint256 depositAmount);
    event BulkWithdraw(address indexed asset, uint256 shareAmount);
    event DepositRefunded(
        uint256 indexed nonce,
        bytes32 depositHash,
        address indexed user
    );
    event DenyFrom(address indexed user);
    event DenyTo(address indexed user);
    event DenyOperator(address indexed user);
    event AllowFrom(address indexed user);
    event AllowTo(address indexed user);
    event AllowOperator(address indexed user);

    // =============================== MODIFIERS ===============================

    /**
     * @notice Reverts if the deposit asset is the native asset.
     */
    modifier revertOnNativeDeposit(address depositAsset) {
        if (depositAsset == NATIVE)
            revert TellerWithMultiAssetSupport__CannotDepositNative();
        _;
    }

    //============================== IMMUTABLES ===============================

    /**
     * @notice The BoringVault this contract is working with.
     */
    BoringVault public immutable vault;

    /**
     * @notice The AccountantWithRateProviders this contract is working with.
     */
    AccountantWithRateProviders public immutable accountant;

    /**
     * @notice One share of the BoringVault.
     */
    uint256 internal immutable ONE_SHARE;

    /**
     * @notice The native wrapper contract.
     */
    WETH public immutable nativeWrapper;

    constructor(
        address _owner,
        address _vault,
        address _accountant,
        address _weth
    ) {
        _initializeOwner(_owner);
        vault = BoringVault(payable(_vault));
        ONE_SHARE = 10 ** vault.decimals();
        accountant = AccountantWithRateProviders(_accountant);
        nativeWrapper = WETH(payable(_weth));
    }

    // ========================================= ADMIN FUNCTIONS =========================================

    /**
     * @notice Pause this contract, which prevents future calls to `deposit` and `depositWithPermit`.
     * @dev Callable by MULTISIG_ROLE.
     */
    function pause() external onlyOwner {
        isPaused = true;
        emit Paused();
    }

    /**
     * @notice Unpause this contract, which allows future calls to `deposit` and `depositWithPermit`.
     * @dev Callable by MULTISIG_ROLE.
     */
    function unpause() external onlyOwner {
        isPaused = false;
        emit Unpaused();
    }

    /**
     * @notice Updates the asset data for a given asset.
     * @dev The accountant must also support pricing this asset, else the `deposit` call will revert.
     * @dev Callable by OWNER_ROLE.
     */
    function updateAssetData(
        ERC20 asset,
        bool allowDeposits,
        bool allowWithdraws,
        uint16 sharePremium
    ) external onlyOwner {
        if (sharePremium > MAX_SHARE_PREMIUM)
            revert TellerWithMultiAssetSupport__SharePremiumTooLarge();
        assetData[asset] = Asset(allowDeposits, allowWithdraws, sharePremium);
        emit AssetDataUpdated(
            address(asset),
            allowDeposits,
            allowWithdraws,
            sharePremium
        );
    }

    /**
     * @notice Sets the share lock period.
     * @dev This not only locks shares to the user address, but also serves as the pending deposit period, where deposits can be reverted.
     * @dev If a new shorter share lock period is set, users with pending share locks could make a new deposit to receive 1 wei shares,
     *      and have their shares unlock sooner than their original deposit allows. This state would allow for the user deposit to be refunded,
     *      but only if they have not transferred their shares out of there wallet. This is an accepted limitation, and should be known when decreasing
     *      the share lock period.
     * @dev Callable by OWNER_ROLE.
     */
    function setShareLockPeriod(uint64 _shareLockPeriod) external onlyOwner {
        if (_shareLockPeriod > MAX_SHARE_LOCK_PERIOD)
            revert TellerWithMultiAssetSupport__ShareLockPeriodTooLong();
        shareLockPeriod = _shareLockPeriod;
    }

    /**
     * @notice Deny a user from transferring or receiving shares.
     * @dev Callable by OWNER_ROLE, and DENIER_ROLE.
     */
    function denyAll(address user) external onlyOwner {
        fromDenyList[user] = true;
        toDenyList[user] = true;
        operatorDenyList[user] = true;
        emit DenyFrom(user);
        emit DenyTo(user);
        emit DenyOperator(user);
    }

    /**
     * @notice Allow a user to transfer or receive shares.
     * @dev Callable by OWNER_ROLE, and DENIER_ROLE.
     */
    function allowAll(address user) external onlyOwner {
        fromDenyList[user] = false;
        toDenyList[user] = false;
        operatorDenyList[user] = false;
        emit AllowFrom(user);
        emit AllowTo(user);
        emit AllowOperator(user);
    }

    /**
     * @notice Deny a user from transferring shares.
     * @dev Callable by OWNER_ROLE, and DENIER_ROLE.
     */
    function denyFrom(address user) external onlyOwner {
        fromDenyList[user] = true;
        emit DenyFrom(user);
    }

    /**
     * @notice Allow a user to transfer shares.
     * @dev Callable by OWNER_ROLE, and DENIER_ROLE.
     */
    function allowFrom(address user) external onlyOwner {
        fromDenyList[user] = false;
        emit AllowFrom(user);
    }

    /**
     * @notice Deny a user from receiving shares.
     * @dev Callable by OWNER_ROLE, and DENIER_ROLE.
     */
    function denyTo(address user) external onlyOwner {
        toDenyList[user] = true;
        emit DenyTo(user);
    }

    /**
     * @notice Allow a user to receive shares.
     * @dev Callable by OWNER_ROLE, and DENIER_ROLE.
     */
    function allowTo(address user) external onlyOwner {
        toDenyList[user] = false;
        emit AllowTo(user);
    }

    /**
     * @notice Deny an operator from transferring shares.
     * @dev Callable by OWNER_ROLE, and DENIER_ROLE.
     */
    function denyOperator(address user) external onlyOwner {
        operatorDenyList[user] = true;
        emit DenyOperator(user);
    }

    /**
     * @notice Allow an operator to transfer shares.
     * @dev Callable by OWNER_ROLE, and DENIER_ROLE.
     */
    function allowOperator(address user) external onlyOwner {
        operatorDenyList[user] = false;
        emit AllowOperator(user);
    }

    // ========================================= BeforeTransferHook FUNCTIONS =========================================

    /**
     * @notice Implement beforeTransfer hook to check if shares are locked, or if `from`, `to`, or `operator` are on the deny list.
     * @notice If share lock period is set to zero, then users will be able to mint and transfer in the same tx.
     *         if this behavior is not desired then a share lock period of >=1 should be used.
     */
    function beforeTransfer(
        address from,
        address to,
        address operator
    ) public view virtual {
        if (
            fromDenyList[from] || toDenyList[to] || operatorDenyList[operator]
        ) {
            revert TellerWithMultiAssetSupport__TransferDenied(
                from,
                to,
                operator
            );
        }
        if (shareUnlockTime[from] > block.timestamp)
            revert TellerWithMultiAssetSupport__SharesAreLocked();
    }

    // ========================================= REVERT DEPOSIT FUNCTIONS =========================================

    /**
     * @notice Allows DEPOSIT_REFUNDER_ROLE to revert a pending deposit.
     * @dev Once a deposit share lock period has passed, it can no longer be reverted.
     * @dev It is possible the admin does not setup the BoringVault to call the transfer hook,
     *      but this contract can still be saving share lock state. In the event this happens
     *      deposits are still refundable if the user has not transferred their shares.
     *      But there is no guarantee that the user has not transferred their shares.
     * @dev Callable by STRATEGIST_MULTISIG_ROLE.
     */
    function refundDeposit(
        uint256 nonce,
        address receiver,
        address depositAsset,
        uint256 depositAmount,
        uint256 shareAmount,
        uint256 depositTimestamp,
        uint256 shareLockUpPeriodAtTimeOfDeposit
    ) external onlyOwner {
        if (
            (block.timestamp - depositTimestamp) >=
            shareLockUpPeriodAtTimeOfDeposit
        ) {
            // Shares are already unlocked, so we can not revert deposit.
            revert TellerWithMultiAssetSupport__SharesAreUnLocked();
        }
        bytes32 depositHash = keccak256(
            abi.encode(
                receiver,
                depositAsset,
                depositAmount,
                shareAmount,
                depositTimestamp,
                shareLockUpPeriodAtTimeOfDeposit
            )
        );
        if (publicDepositHistory[nonce] != depositHash)
            revert TellerWithMultiAssetSupport__BadDepositHash();

        // Delete hash to prevent refund gas.
        delete publicDepositHistory[nonce];

        // If deposit used native asset, send user back wrapped native asset.
        depositAsset = depositAsset == NATIVE
            ? address(nativeWrapper)
            : depositAsset;
        // Burn shares and refund assets to receiver.
        vault.exit(
            receiver,
            ERC20(depositAsset),
            depositAmount,
            receiver,
            shareAmount
        );

        emit DepositRefunded(nonce, depositHash, receiver);
    }

    // ========================================= USER FUNCTIONS =========================================

    /**
     * @notice Allows users to deposit into the BoringVault, if this contract is not paused.
     * @dev Publicly callable.
     */
    function deposit(
        ERC20 depositAsset,
        uint256 depositAmount,
        uint256 minimumMint
    ) external payable nonReentrant returns (uint256 shares) {
        Asset memory asset = _beforeDeposit(depositAsset);

        address from;
        if (address(depositAsset) == NATIVE) {
            if (msg.value == 0)
                revert TellerWithMultiAssetSupport__ZeroAssets();
            nativeWrapper.deposit{value: msg.value}();
            // Set depositAmount to msg.value.
            depositAmount = msg.value;
            SafeTransferLib.safeApprove(
                address(nativeWrapper),
                address(vault),
                depositAmount
            );
            // Update depositAsset to nativeWrapper.
            depositAsset = nativeWrapper;
            // Set from to this address since user transferred value.
            from = address(this);
        } else {
            if (msg.value > 0)
                revert TellerWithMultiAssetSupport__DualDeposit();
            from = msg.sender;
        }

        shares = _erc20Deposit(
            depositAsset,
            depositAmount,
            minimumMint,
            from,
            msg.sender,
            asset
        );
        _afterPublicDeposit(
            msg.sender,
            depositAsset,
            depositAmount,
            shares,
            shareLockPeriod
        );
    }

    /**
     * @notice Allows users to deposit into BoringVault using permit.
     * @dev Publicly callable.
     */
    function depositWithPermit(
        ERC20 depositAsset,
        uint256 depositAmount,
        uint256 minimumMint,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        external
        nonReentrant
        revertOnNativeDeposit(address(depositAsset))
        returns (uint256 shares)
    {
        Asset memory asset = _beforeDeposit(depositAsset);

        _handlePermit(depositAsset, depositAmount, deadline, v, r, s);

        shares = _erc20Deposit(
            depositAsset,
            depositAmount,
            minimumMint,
            msg.sender,
            msg.sender,
            asset
        );
        _afterPublicDeposit(
            msg.sender,
            depositAsset,
            depositAmount,
            shares,
            shareLockPeriod
        );
    }

    /**
     * @notice Allows on ramp role to deposit into this contract.
     * @dev Does NOT support native deposits.
     * @dev Callable by SOLVER_ROLE.
     */
    function bulkDeposit(
        ERC20 depositAsset,
        uint256 depositAmount,
        uint256 minimumMint,
        address to
    ) external onlyOwner nonReentrant returns (uint256 shares) {
        Asset memory asset = _beforeDeposit(depositAsset);

        shares = _erc20Deposit(
            depositAsset,
            depositAmount,
            minimumMint,
            msg.sender,
            to,
            asset
        );
        emit BulkDeposit(address(depositAsset), depositAmount);
    }

    /**
     * @notice Allows off ramp role to withdraw from this contract.
     * @dev Callable by SOLVER_ROLE.
     */
    function bulkWithdraw(
        ERC20 withdrawAsset,
        uint256 shareAmount,
        uint256 minimumAssets,
        address to
    ) external onlyOwner returns (uint256 assetsOut) {
        if (isPaused) revert TellerWithMultiAssetSupport__Paused();
        Asset memory asset = assetData[withdrawAsset];
        if (!asset.allowWithdraws)
            revert TellerWithMultiAssetSupport__AssetNotSupported();

        if (shareAmount == 0) revert TellerWithMultiAssetSupport__ZeroShares();
        assetsOut = FixedPointMathLib.mulDiv(
            shareAmount,
            accountant.getRateInQuoteSafe(withdrawAsset),
            ONE_SHARE
        );
        if (assetsOut < minimumAssets)
            revert TellerWithMultiAssetSupport__MinimumAssetsNotMet();
        vault.exit(to, withdrawAsset, assetsOut, msg.sender, shareAmount);
        emit BulkWithdraw(address(withdrawAsset), shareAmount);
    }

    // ========================================= INTERNAL HELPER FUNCTIONS =========================================

    /**
     * @notice Implements a common ERC20 deposit into BoringVault.
     */
    function _erc20Deposit(
        ERC20 depositAsset,
        uint256 depositAmount,
        uint256 minimumMint,
        address from,
        address to,
        Asset memory asset
    ) internal returns (uint256 shares) {
        if (depositAmount == 0)
            revert TellerWithMultiAssetSupport__ZeroAssets();
        shares = FixedPointMathLib.mulDiv(
            depositAmount,
            ONE_SHARE,
            accountant.getRateInQuoteSafe(depositAsset)
        );
        shares = asset.sharePremium > 0
            ? FixedPointMathLib.mulDiv(shares, 1e4 - asset.sharePremium, 1e4)
            : shares;
        if (shares < minimumMint)
            revert TellerWithMultiAssetSupport__MinimumMintNotMet();
        vault.enter(from, depositAsset, depositAmount, to, shares);
    }

    /**
     * @notice Handle pre-deposit checks.
     */
    function _beforeDeposit(
        ERC20 depositAsset
    ) internal view returns (Asset memory asset) {
        if (isPaused) revert TellerWithMultiAssetSupport__Paused();
        asset = assetData[depositAsset];
        if (!asset.allowDeposits)
            revert TellerWithMultiAssetSupport__AssetNotSupported();
    }

    /**
     * @notice Handle share lock logic, and event.
     */
    function _afterPublicDeposit(
        address user,
        ERC20 depositAsset,
        uint256 depositAmount,
        uint256 shares,
        uint256 currentShareLockPeriod
    ) internal {
        // Increment then assign as its slightly more gas efficient.
        uint256 nonce = ++depositNonce;
        // Only set share unlock time and history if share lock period is greater than 0.
        if (currentShareLockPeriod > 0) {
            shareUnlockTime[user] = block.timestamp + currentShareLockPeriod;
            publicDepositHistory[nonce] = keccak256(
                abi.encode(
                    user,
                    depositAsset,
                    depositAmount,
                    shares,
                    block.timestamp,
                    currentShareLockPeriod
                )
            );
        }
        emit Deposit(
            nonce,
            user,
            address(depositAsset),
            depositAmount,
            shares,
            block.timestamp,
            currentShareLockPeriod
        );
    }

    /**
     * @notice Handle permit logic.
     */
    function _handlePermit(
        ERC20 depositAsset,
        uint256 depositAmount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        try
            depositAsset.permit(
                msg.sender,
                address(vault),
                depositAmount,
                deadline,
                v,
                r,
                s
            )
        {} catch {
            if (
                depositAsset.allowance(msg.sender, address(vault)) <
                depositAmount
            ) {
                revert TellerWithMultiAssetSupport__PermitFailedAndAllowanceTooLow();
            }
        }
    }
}
