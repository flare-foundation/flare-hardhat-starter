// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.25;

interface ITokenizedVault {
    // Structs
    struct ConfigInfo {
        uint256 maxDepositAmount;
        uint256 maxWithdrawalAmount;
        uint256 instantRedemptionFee;
        uint256 lagDuration;
        uint256 withdrawalFee;
        uint256 watermarkTimeWindow;
        uint256 maxChangePercent;
        uint256 managementFeePercent;
        uint256 performanceFeeRate;
        address sendersWhitelistAddress;
        address operatorAddress;
        address scheduledCallerAddress;
        address lpTokenAddress;
        address referenceAsset;
        address futureOwnerAddress;
        address assetsWhitelistAddress;
    }

    struct CollectorDefinition {
        address collectorAddress;
        uint256 percentage;
    }

    // Events
    event ContractConfigured();
    event OnEmergencyWithdraw(address receiverAddr);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event SendersWhitelistUpdated(address newWhitelistAddr);
    event SubAccountEnabled(address subAccountAddr);
    event SubAccountDisabled(address subAccountAddr);
    event DepositWithdrawalStatusChanged(bool bDepositsPaused, bool bWithdrawalsPaused);
    event FeesCollected();
    event MaxChangePercentUpdated(uint256 newValue);
    event ManagementFeeUpdated(uint256 newManagementFeePercent);
    event ManagementFeeCharged(uint256 managementFeeAmount);
    event Deposit(
        address assetIn,
        uint256 amountIn,
        uint256 shares,
        address indexed senderAddr,
        address indexed receiverAddr
    );
    event WithdrawalRequested(uint256 shares, address indexed holderAddr, address indexed receiverAddr);
    event WithdrawalProcessed(uint256 assetsAmount, address indexed receiverAddr);
    event Withdraw(
        address indexed sender,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    // Errors
    error HighWatermarkViolation();
    error HighWatermarkDurationError();
    error TokenDecimalsMismatch();
    error InvalidLagDuration();
    error OwnerOnly();
    error OwnerAddressRequired();
    error ReentrancyGuardReentrantCall();
    error NotConfigured();
    error AlreadyConfigured();
    error InvalidAddress();
    error Unauthorized();
    error OperatorOnly();
    error OnlyOwnerOrOperator();
    error InvalidAccountType();
    error InvalidAmount();
    error FeesMustSum100();
    error SenderNotWhitelisted();
    error MissingFeeCollectors();
    error ZeroAddressError();
    error WhitelistLimitReached();
    error AssetNotWhitelisted();
    error CollectableFeesExceeded(uint256 fee, uint256 remaining);
    error InvalidTimestamp();
    error DepositsPaused();
    error InvalidReceiver();
    error MaxDepositAmountReached();
    error InsufficientShares();
    error MaxAllowedChangeReached();
    error AccountNotWhitelisted();
    error InvalidExternalAssets();
    error ReferenceAssetMismatch();
    error FeeAmountTooLow();
    error DepositCapReached();
    error WithdrawalsPaused();
    error WithdrawalLimitReached();
    error AmountTooLow();
    error NoSharesForReceiver();
    error TooEarly();
    error NothingToProcess();
    error LimitRequired();
    error VaultNotTimelocked();
    error InvalidDepositLimit();
    error InvalidWithdrawalLimit();

    // Initialization & Configuration
    function initialize(address ownerAddr) external;
    function configure(ConfigInfo memory newConfig) external;

    // Ownership
    function owner() external view returns (address);
    function pendingOwner() external view returns (address);
    function transferOwnership(address newOwner) external;
    function acceptOwnership() external;

    // Deposit Functions
    function deposit(address assetIn, uint256 amountIn, address receiverAddr) external returns (uint256 shares);
    function depositWithPermit(
        address assetIn,
        uint256 amountIn,
        address receiverAddr,
        uint256 deadline,
        bytes32 r,
        bytes32 s,
        uint8 v
    ) external returns (uint256 shares);
    function depositToSubaccount(address inputAssetAddr, uint256 depositAmount, address subAccountAddr) external;
    function previewDeposit(
        address assetIn,
        uint256 amountIn
    ) external view returns (uint256 shares, uint256 amountInReferenceTokens);

    // Withdrawal Functions
    function instantRedeem(uint256 shares, address receiverAddr) external;
    function requestRedeem(
        uint256 shares,
        address receiverAddr
    ) external returns (uint256 claimableEpoch, uint256 year, uint256 month, uint256 day);
    function claim(
        uint256 year,
        uint256 month,
        uint256 day,
        address receiverAddr
    ) external returns (uint256 shares, uint256 assetsAfterFee);
    function processAllClaimsByDate(uint256 year, uint256 month, uint256 day, uint256 maxLimit) external;
    function withdrawFromSubaccount(address inputAssetAddr, uint256 amount, address subAccountAddr) external;
    function previewRedemption(
        uint256 shares,
        bool isInstant
    ) external view returns (uint256 assetsAmount, uint256 assetsAfterFee);

    // Fee Functions
    function chargeManagementFee() external;
    function chargePerformanceFees() external;
    function collectFees() external;
    function updateFeeCollectors(CollectorDefinition[] calldata collectors) external;
    function updatePerformanceFeeCollectors(CollectorDefinition[] calldata collectors) external;
    function getFeeCollectors() external view returns (CollectorDefinition[] memory);
    function getPerformanceFeeRecipients() external view returns (CollectorDefinition[] memory);

    // Admin Functions
    function pauseDepositsAndWithdrawals(bool bPauseDeposits, bool bPauseWithdrawals) external;
    function updateSendersWhitelist(address newWhitelistAddr) external;
    function updateAssetsWhitelist(address newWhitelistAddr) external;
    function enableSubAccount(address addr, uint8 accountType) external;
    function disableSubAccount(address addr) external;
    function updateTotalAssets(uint256 externalAssetsAmount) external;
    function updateMaxChangePercent(uint256 newValue) external;
    function updateManagementFee(uint256 newManagementFeePercent) external;
    function updateInstantRedemptionFee(uint256 newValue, bool pKeepFeeInVault) external;
    function updateLimits(uint256 newMaxDepositAmount, uint256 newMaxWithdrawalAmount, uint256 newDepositCap) external;
    function updateTimelockDuration(uint256 newDuration) external;
    function updatePerformanceFee(uint256 newValue) external;
    function emergencyWithdraw(address receiverAddr) external;

    // View Functions - State Variables
    function asset() external view returns (address);
    function lpTokenAddress() external view returns (address);
    function operatorAddress() external view returns (address);
    function scheduledCallerAddress() external view returns (address);
    function sendersWhitelistAddress() external view returns (address);
    function assetsWhitelistAddress() external view returns (address);
    function depositsPaused() external view returns (bool);
    function withdrawalsPaused() external view returns (bool);
    function keepFeeInVault() external view returns (bool);
    function externalAssets() external view returns (uint256);
    function totalCollectableFees() external view returns (uint256);
    function maxChangePercent() external view returns (uint256);
    function assetsUpdatedOn() external view returns (uint256);
    function feesTimestamp() external view returns (uint256);
    function managementFeePercent() external view returns (uint256);
    function maxDepositAmount() external view returns (uint256);
    function depositCap() external view returns (uint256);
    function maxWithdrawalAmount() external view returns (uint256);
    function instantRedemptionFee() external view returns (uint256);
    function lagDuration() external view returns (uint256);
    function withdrawalFee() external view returns (uint256);
    function globalLiabilityShares() external view returns (uint256);
    function highWatermark() external view returns (uint256);
    function watermarkUpdatedOn() external view returns (uint256);
    function watermarkTimeWindow() external view returns (uint256);
    function performanceFeeRate() external view returns (uint256);
    function whitelistedSubAccounts(address addr) external view returns (uint8);
    function feeCollectors(uint256 index) external view returns (address collectorAddress, uint256 percentage);
    function performanceFeeRecipients(
        uint256 index
    ) external view returns (address collectorAddress, uint256 percentage);

    // View Functions - Computed Values
    function getSharePrice() external view returns (uint256);
    function getTotalAssets() external view returns (uint256);
    function getChangePercentage(uint256 externalAssetsAmount) external view returns (uint256);
    function getMaxAllowedChange() external view returns (uint256);
    function getWithdrawalEpoch()
        external
        view
        returns (uint256 year, uint256 month, uint256 day, uint256 claimableEpoch);
    function getRequirementByDate(uint256 year, uint256 month, uint256 day) external view returns (uint256 shares);
    function getBurnableAmountByReceiver(
        uint256 year,
        uint256 month,
        uint256 day,
        address receiverAddr
    ) external view returns (uint256);
    function getScheduledTransactionsByDate(
        uint256 year,
        uint256 month,
        uint256 day
    ) external view returns (uint256 totalTransactions, uint256 executionEpoch);
}
