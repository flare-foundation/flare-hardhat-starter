// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FixedPointMathLib} from "solady/src/utils/FixedPointMathLib.sol";
import {IRateProvider} from "./interfaces/IRateProvider.sol";
import {ERC20} from "solady/src/tokens/ERC20.sol";
import {SafeTransferLib} from "solady/src/utils/SafeTransferLib.sol";
import {BoringVault} from "./BoringVault.sol";
import {Ownable} from "solady/src/auth/Ownable.sol";
import {IPausable} from "./interfaces/IPausable.sol";

contract AccountantWithRateProviders is Ownable, IRateProvider, IPausable {
    // ========================================= STRUCTS =========================================

    /**
     * @param payoutAddress the address `claimFees` sends fees to
     * @param highwaterMark the highest value of the BoringVault's share price
     * @param feesOwedInBase total pending fees owed in terms of base
     * @param totalSharesLastUpdate total amount of shares the last exchange rate update
     * @param exchangeRate the current exchange rate in terms of base
     * @param allowedExchangeRateChangeUpper the max allowed change to exchange rate from an update
     * @param allowedExchangeRateChangeLower the min allowed change to exchange rate from an update
     * @param lastUpdateTimestamp the block timestamp of the last exchange rate update
     * @param isPaused whether or not this contract is paused
     * @param minimumUpdateDelayInSeconds the minimum amount of time that must pass between
     *        exchange rate updates, such that the update won't trigger the contract to be paused
     * @param platformFee the platform fee
     * @param performanceFee the performance fee
     */
    struct AccountantState {
        address payoutAddress;
        uint96 highwaterMark;
        uint128 feesOwedInBase;
        uint128 totalSharesLastUpdate;
        uint96 exchangeRate;
        uint16 allowedExchangeRateChangeUpper;
        uint16 allowedExchangeRateChangeLower;
        uint64 lastUpdateTimestamp;
        bool isPaused;
        uint24 minimumUpdateDelayInSeconds;
        uint16 platformFee;
        uint16 performanceFee;
    }

    /**
     * @param isPeggedToBase whether or not the asset is 1:1 with the base asset
     * @param rateProvider the rate provider for this asset if `isPeggedToBase` is false
     */
    struct RateProviderData {
        bool isPeggedToBase;
        IRateProvider rateProvider;
    }

    // ========================================= STATE =========================================

    /**
     * @notice Store the accountant state in 3 packed slots.
     */
    AccountantState public accountantState;

    /**
     * @notice Maps ERC20s to their RateProviderData.
     */
    mapping(ERC20 => RateProviderData) public rateProviderData;

    //============================== ERRORS ===============================

    error AccountantWithRateProviders__UpperBoundTooSmall();
    error AccountantWithRateProviders__LowerBoundTooLarge();
    error AccountantWithRateProviders__PlatformFeeTooLarge();
    error AccountantWithRateProviders__PerformanceFeeTooLarge();
    error AccountantWithRateProviders__Paused();
    error AccountantWithRateProviders__ZeroFeesOwed();
    error AccountantWithRateProviders__OnlyCallableByBoringVault();
    error AccountantWithRateProviders__UpdateDelayTooLarge();
    error AccountantWithRateProviders__ExchangeRateAboveHighwaterMark();

    //============================== EVENTS ===============================

    event Paused();
    event Unpaused();
    event DelayInSecondsUpdated(uint24 oldDelay, uint24 newDelay);
    event UpperBoundUpdated(uint16 oldBound, uint16 newBound);
    event LowerBoundUpdated(uint16 oldBound, uint16 newBound);
    event PlatformFeeUpdated(uint16 oldFee, uint16 newFee);
    event PerformanceFeeUpdated(uint16 oldFee, uint16 newFee);
    event PayoutAddressUpdated(address oldPayout, address newPayout);
    event RateProviderUpdated(
        address asset,
        bool isPegged,
        address rateProvider
    );
    event ExchangeRateUpdated(
        uint96 oldRate,
        uint96 newRate,
        uint64 currentTime
    );
    event FeesClaimed(address indexed feeAsset, uint256 amount);
    event HighwaterMarkReset();

    //============================== IMMUTABLES ===============================

    /**
     * @notice The base asset rates are provided in.
     */
    ERC20 public immutable base;

    /**
     * @notice The decimals rates are provided in.
     */
    uint8 public immutable decimals;

    /**
     * @notice The BoringVault this accountant is working with.
     *         Used to determine share supply for fee calculation.
     */
    BoringVault public immutable vault;

    /**
     * @notice One share of the BoringVault.
     */
    uint256 internal immutable ONE_SHARE;

    constructor(
        address _owner,
        address _vault,
        address payoutAddress,
        uint96 startingExchangeRate,
        address _base,
        uint16 allowedExchangeRateChangeUpper,
        uint16 allowedExchangeRateChangeLower,
        uint24 minimumUpdateDelayInSeconds,
        uint16 platformFee,
        uint16 performanceFee
    ) {
        _initializeOwner(_owner);
        base = ERC20(_base);
        decimals = ERC20(_base).decimals();
        vault = BoringVault(payable(_vault));
        ONE_SHARE = 10 ** vault.decimals();
        accountantState = AccountantState({
            payoutAddress: payoutAddress,
            highwaterMark: startingExchangeRate,
            feesOwedInBase: 0,
            totalSharesLastUpdate: uint128(vault.totalSupply()),
            exchangeRate: startingExchangeRate,
            allowedExchangeRateChangeUpper: allowedExchangeRateChangeUpper,
            allowedExchangeRateChangeLower: allowedExchangeRateChangeLower,
            lastUpdateTimestamp: uint64(block.timestamp),
            isPaused: false,
            minimumUpdateDelayInSeconds: minimumUpdateDelayInSeconds,
            platformFee: platformFee,
            performanceFee: performanceFee
        });
    }

    // ========================================= ADMIN FUNCTIONS =========================================
    /**
     * @notice Pause this contract, which prevents future calls to `updateExchangeRate`, and any safe rate
     *         calls will revert.
     * @dev Callable by MULTISIG_ROLE.
     */
    function pause() external onlyOwner {
        accountantState.isPaused = true;
        emit Paused();
    }

    /**
     * @notice Unpause this contract, which allows future calls to `updateExchangeRate`, and any safe rate
     *         calls will stop reverting.
     * @dev Callable by MULTISIG_ROLE.
     */
    function unpause() external onlyOwner {
        accountantState.isPaused = false;
        emit Unpaused();
    }

    /**
     * @notice Update the minimum time delay between `updateExchangeRate` calls.
     * @dev There are no input requirements, as it is possible the admin would want
     *      the exchange rate updated as frequently as needed.
     * @dev Callable by OWNER_ROLE.
     */
    function updateDelay(
        uint24 minimumUpdateDelayInSeconds
    ) external onlyOwner {
        if (minimumUpdateDelayInSeconds > 14 days)
            revert AccountantWithRateProviders__UpdateDelayTooLarge();
        uint24 oldDelay = accountantState.minimumUpdateDelayInSeconds;
        accountantState
            .minimumUpdateDelayInSeconds = minimumUpdateDelayInSeconds;
        emit DelayInSecondsUpdated(oldDelay, minimumUpdateDelayInSeconds);
    }

    /**
     * @notice Update the allowed upper bound change of exchange rate between `updateExchangeRateCalls`.
     * @dev Callable by OWNER_ROLE.
     */
    function updateUpper(
        uint16 allowedExchangeRateChangeUpper
    ) external onlyOwner {
        if (allowedExchangeRateChangeUpper < 1e4)
            revert AccountantWithRateProviders__UpperBoundTooSmall();
        uint16 oldBound = accountantState.allowedExchangeRateChangeUpper;
        accountantState
            .allowedExchangeRateChangeUpper = allowedExchangeRateChangeUpper;
        emit UpperBoundUpdated(oldBound, allowedExchangeRateChangeUpper);
    }

    /**
     * @notice Update the allowed lower bound change of exchange rate between `updateExchangeRateCalls`.
     * @dev Callable by OWNER_ROLE.
     */
    function updateLower(
        uint16 allowedExchangeRateChangeLower
    ) external onlyOwner {
        if (allowedExchangeRateChangeLower > 1e4)
            revert AccountantWithRateProviders__LowerBoundTooLarge();
        uint16 oldBound = accountantState.allowedExchangeRateChangeLower;
        accountantState
            .allowedExchangeRateChangeLower = allowedExchangeRateChangeLower;
        emit LowerBoundUpdated(oldBound, allowedExchangeRateChangeLower);
    }

    /**
     * @notice Update the platform fee to a new value.
     * @dev Callable by OWNER_ROLE.
     */
    function updatePlatformFee(uint16 platformFee) external onlyOwner {
        if (platformFee > 0.2e4)
            revert AccountantWithRateProviders__PlatformFeeTooLarge();
        uint16 oldFee = accountantState.platformFee;
        accountantState.platformFee = platformFee;
        emit PlatformFeeUpdated(oldFee, platformFee);
    }

    /**
     * @notice Update the performance fee to a new value.
     * @dev Callable by OWNER_ROLE.
     */
    function updatePerformanceFee(uint16 performanceFee) external onlyOwner {
        if (performanceFee > 0.5e4)
            revert AccountantWithRateProviders__PerformanceFeeTooLarge();
        uint16 oldFee = accountantState.performanceFee;
        accountantState.performanceFee = performanceFee;
        emit PerformanceFeeUpdated(oldFee, performanceFee);
    }

    /**
     * @notice Update the payout address fees are sent to.
     * @dev Callable by OWNER_ROLE.
     */
    function updatePayoutAddress(address payoutAddress) external onlyOwner {
        address oldPayout = accountantState.payoutAddress;
        accountantState.payoutAddress = payoutAddress;
        emit PayoutAddressUpdated(oldPayout, payoutAddress);
    }

    /**
     * @notice Update the rate provider data for a specific `asset`.
     * @dev Rate providers must return rates in terms of `base` or
     * an asset pegged to base and they must use the same decimals
     * as `asset`.
     * @dev Callable by OWNER_ROLE.
     */
    function setRateProviderData(
        ERC20 asset,
        bool isPeggedToBase,
        address rateProvider
    ) external onlyOwner {
        rateProviderData[asset] = RateProviderData({
            isPeggedToBase: isPeggedToBase,
            rateProvider: IRateProvider(rateProvider)
        });
        emit RateProviderUpdated(address(asset), isPeggedToBase, rateProvider);
    }

    /**
     * @notice Reset the highwater mark to the current exchange rate.
     * @dev Callable by OWNER_ROLE.
     */
    function resetHighwaterMark() external virtual onlyOwner {
        AccountantState storage state = accountantState;

        if (state.exchangeRate > state.highwaterMark) {
            revert AccountantWithRateProviders__ExchangeRateAboveHighwaterMark();
        }

        uint64 currentTime = uint64(block.timestamp);
        uint256 currentTotalShares = vault.totalSupply();
        _calculateFeesOwed(
            state,
            state.exchangeRate,
            state.exchangeRate,
            currentTotalShares,
            currentTime
        );
        state.totalSharesLastUpdate = uint128(currentTotalShares);
        state.highwaterMark = accountantState.exchangeRate;
        state.lastUpdateTimestamp = currentTime;

        emit HighwaterMarkReset();
    }

    // ========================================= UPDATE EXCHANGE RATE/FEES FUNCTIONS =========================================

    /**
     * @notice Updates this contract exchangeRate.
     * @dev If new exchange rate is outside of accepted bounds, or if not enough time has passed, this
     *      will pause the contract, and this function will NOT calculate fees owed.
     * @dev Callable by UPDATE_EXCHANGE_RATE_ROLE.
     */
    function updateExchangeRate(
        uint96 newExchangeRate
    ) external virtual onlyOwner {
        (
            bool shouldPause,
            AccountantState storage state,
            uint64 currentTime,
            uint256 currentExchangeRate,
            uint256 currentTotalShares
        ) = _beforeUpdateExchangeRate(newExchangeRate);
        if (shouldPause) {
            // Instead of reverting, pause the contract. This way the exchange rate updater is able to update the exchange rate
            // to a better value, and pause it.
            state.isPaused = true;
        } else {
            _calculateFeesOwed(
                state,
                newExchangeRate,
                currentExchangeRate,
                currentTotalShares,
                currentTime
            );
        }

        newExchangeRate = _setExchangeRate(newExchangeRate, state);
        state.totalSharesLastUpdate = uint128(currentTotalShares);
        state.lastUpdateTimestamp = currentTime;

        emit ExchangeRateUpdated(
            uint96(currentExchangeRate),
            newExchangeRate,
            currentTime
        );
    }

    /**
     * @notice Claim pending fees.
     * @dev This function must be called by the BoringVault.
     * @dev This function will lose precision if the exchange rate
     *      decimals is greater than the feeAsset's decimals.
     */
    function claimFees(ERC20 feeAsset) external {
        if (msg.sender != address(vault))
            revert AccountantWithRateProviders__OnlyCallableByBoringVault();

        AccountantState storage state = accountantState;
        if (state.isPaused) revert AccountantWithRateProviders__Paused();
        if (state.feesOwedInBase == 0)
            revert AccountantWithRateProviders__ZeroFeesOwed();

        // Determine amount of fees owed in feeAsset.
        uint256 feesOwedInFeeAsset;
        RateProviderData memory data = rateProviderData[feeAsset];
        if (address(feeAsset) == address(base)) {
            feesOwedInFeeAsset = state.feesOwedInBase;
        } else {
            uint8 feeAssetDecimals = ERC20(feeAsset).decimals();
            uint256 feesOwedInBaseUsingFeeAssetDecimals = _changeDecimals(
                state.feesOwedInBase,
                decimals,
                feeAssetDecimals
            );
            if (data.isPeggedToBase) {
                feesOwedInFeeAsset = feesOwedInBaseUsingFeeAssetDecimals;
            } else {
                uint256 rate = data.rateProvider.getRate();
                feesOwedInFeeAsset = FixedPointMathLib.mulDiv(
                    feesOwedInBaseUsingFeeAssetDecimals,
                    10 ** feeAssetDecimals,
                    rate
                );
            }
        }
        // Zero out fees owed.
        state.feesOwedInBase = 0;
        // Transfer fee asset to payout address.
        SafeTransferLib.safeTransferFrom(
            address(feeAsset),
            msg.sender,
            state.payoutAddress,
            feesOwedInFeeAsset
        );

        emit FeesClaimed(address(feeAsset), feesOwedInFeeAsset);
    }

    // ========================================= VIEW FUNCTIONS =========================================

    /**
     * @notice Get this BoringVault's current rate in the base.
     */
    function getRate() public view returns (uint256 rate) {
        rate = accountantState.exchangeRate;
    }

    /**
     * @notice Get this BoringVault's current rate in the base.
     * @dev Revert if paused.
     */
    function getRateSafe() external view returns (uint256 rate) {
        if (accountantState.isPaused)
            revert AccountantWithRateProviders__Paused();
        rate = getRate();
    }

    /**
     * @notice Get this BoringVault's current rate in the provided quote.
     * @dev `quote` must have its RateProviderData set, else this will revert.
     * @dev This function will lose precision if the exchange rate
     *      decimals is greater than the quote's decimals.
     */
    function getRateInQuote(
        ERC20 quote
    ) public view returns (uint256 rateInQuote) {
        if (address(quote) == address(base)) {
            rateInQuote = accountantState.exchangeRate;
        } else {
            RateProviderData memory data = rateProviderData[quote];
            uint8 quoteDecimals = ERC20(quote).decimals();
            uint256 exchangeRateInQuoteDecimals = _changeDecimals(
                accountantState.exchangeRate,
                decimals,
                quoteDecimals
            );
            if (data.isPeggedToBase) {
                rateInQuote = exchangeRateInQuoteDecimals;
            } else {
                uint256 quoteRate = data.rateProvider.getRate();
                uint256 oneQuote = 10 ** quoteDecimals;
                rateInQuote = FixedPointMathLib.mulDiv(
                    oneQuote,
                    exchangeRateInQuoteDecimals,
                    quoteRate
                );
            }
        }
    }

    /**
     * @notice Get this BoringVault's current rate in the provided quote.
     * @dev `quote` must have its RateProviderData set, else this will revert.
     * @dev Revert if paused.
     */
    function getRateInQuoteSafe(
        ERC20 quote
    ) external view returns (uint256 rateInQuote) {
        if (accountantState.isPaused)
            revert AccountantWithRateProviders__Paused();
        rateInQuote = getRateInQuote(quote);
    }

    /**
     * @notice Preview the result of an update to the exchange rate.
     * @return updateWillPause Whether the update will pause the contract.
     * @return newFeesOwedInBase The new fees owed in base.
     * @return totalFeesOwedInBase The total fees owed in base.
     */
    function previewUpdateExchangeRate(
        uint96 newExchangeRate
    )
        external
        view
        virtual
        returns (
            bool updateWillPause,
            uint256 newFeesOwedInBase,
            uint256 totalFeesOwedInBase
        )
    {
        (
            bool shouldPause,
            AccountantState storage state,
            uint64 currentTime,
            uint256 currentExchangeRate,
            uint256 currentTotalShares
        ) = _beforeUpdateExchangeRate(newExchangeRate);
        updateWillPause = shouldPause;
        totalFeesOwedInBase = state.feesOwedInBase;
        if (!shouldPause) {
            (
                uint256 platformFeesOwedInBase,
                uint256 shareSupplyToUse
            ) = _calculatePlatformFee(
                    state.totalSharesLastUpdate,
                    state.lastUpdateTimestamp,
                    state.platformFee,
                    newExchangeRate,
                    currentExchangeRate,
                    currentTotalShares,
                    currentTime
                );

            uint256 performanceFeesOwedInBase;
            if (newExchangeRate > state.highwaterMark) {
                (performanceFeesOwedInBase, ) = _calculatePerformanceFee(
                    newExchangeRate,
                    shareSupplyToUse,
                    state.highwaterMark,
                    state.performanceFee
                );
            }
            newFeesOwedInBase =
                platformFeesOwedInBase +
                performanceFeesOwedInBase;
            totalFeesOwedInBase += newFeesOwedInBase;
        }
    }

    // ========================================= INTERNAL HELPER FUNCTIONS =========================================
    /**
     * @notice Used to change the decimals of precision used for an amount.
     */
    function _changeDecimals(
        uint256 amount,
        uint8 fromDecimals,
        uint8 toDecimals
    ) internal pure returns (uint256) {
        if (fromDecimals == toDecimals) {
            return amount;
        } else if (fromDecimals < toDecimals) {
            return amount * 10 ** (toDecimals - fromDecimals);
        } else {
            return amount / 10 ** (fromDecimals - toDecimals);
        }
    }

    /**
     * @notice Check if the new exchange rate is outside of the allowed bounds or if not enough time has passed.
     */
    function _beforeUpdateExchangeRate(
        uint96 newExchangeRate
    )
        internal
        view
        returns (
            bool shouldPause,
            AccountantState storage state,
            uint64 currentTime,
            uint256 currentExchangeRate,
            uint256 currentTotalShares
        )
    {
        state = accountantState;
        if (state.isPaused) revert AccountantWithRateProviders__Paused();
        currentTime = uint64(block.timestamp);
        currentExchangeRate = state.exchangeRate;
        currentTotalShares = vault.totalSupply();
        shouldPause =
            currentTime <
            state.lastUpdateTimestamp + state.minimumUpdateDelayInSeconds ||
            newExchangeRate >
            FixedPointMathLib.mulDiv(
                currentExchangeRate,
                state.allowedExchangeRateChangeUpper,
                1e4
            ) ||
            newExchangeRate <
            FixedPointMathLib.mulDiv(
                currentExchangeRate,
                state.allowedExchangeRateChangeLower,
                1e4
            );
    }

    /**
     * @notice Set the exchange rate.
     */
    function _setExchangeRate(
        uint96 newExchangeRate,
        AccountantState storage state
    ) internal virtual returns (uint96) {
        state.exchangeRate = newExchangeRate;
        return newExchangeRate;
    }

    /**
     * @notice Calculate platform fees.
     */
    function _calculatePlatformFee(
        uint128 totalSharesLastUpdate,
        uint64 lastUpdateTimestamp,
        uint16 platformFee,
        uint96 newExchangeRate,
        uint256 currentExchangeRate,
        uint256 currentTotalShares,
        uint64 currentTime
    )
        internal
        view
        returns (uint256 platformFeesOwedInBase, uint256 shareSupplyToUse)
    {
        shareSupplyToUse = currentTotalShares;
        // Use the minimum between current total supply and total supply for last update.
        if (totalSharesLastUpdate < shareSupplyToUse) {
            shareSupplyToUse = totalSharesLastUpdate;
        }

        // Determine platform fees owned.
        if (platformFee > 0) {
            uint256 timeDelta = currentTime - lastUpdateTimestamp;
            uint256 minimumAssets = newExchangeRate > currentExchangeRate
                ? FixedPointMathLib.mulDiv(
                    shareSupplyToUse,
                    currentExchangeRate,
                    ONE_SHARE
                )
                : FixedPointMathLib.mulDiv(
                    shareSupplyToUse,
                    newExchangeRate,
                    ONE_SHARE
                );
            uint256 platformFeesAnnual = FixedPointMathLib.mulDiv(
                minimumAssets,
                platformFee,
                1e4
            );
            platformFeesOwedInBase = FixedPointMathLib.mulDiv(
                platformFeesAnnual,
                timeDelta,
                365 days
            );
        }
    }

    /**
     * @notice Calculate performance fees.
     */
    function _calculatePerformanceFee(
        uint96 newExchangeRate,
        uint256 shareSupplyToUse,
        uint96 datum,
        uint16 performanceFee
    )
        internal
        view
        returns (uint256 performanceFeesOwedInBase, uint256 yieldEarned)
    {
        uint256 changeInExchangeRate = newExchangeRate - datum;
        yieldEarned = FixedPointMathLib.mulDiv(
            changeInExchangeRate,
            shareSupplyToUse,
            ONE_SHARE
        );
        if (performanceFee > 0) {
            performanceFeesOwedInBase = FixedPointMathLib.mulDiv(
                yieldEarned,
                performanceFee,
                1e4
            );
        }
    }

    /**
     * @notice Calculate fees owed in base.
     * @dev This function will update the highwater mark if the new exchange rate is higher.
     */
    function _calculateFeesOwed(
        AccountantState storage state,
        uint96 newExchangeRate,
        uint256 currentExchangeRate,
        uint256 currentTotalShares,
        uint64 currentTime
    ) internal virtual {
        // Only update fees if we are not paused.
        // Update fee accounting.
        (
            uint256 newFeesOwedInBase,
            uint256 shareSupplyToUse
        ) = _calculatePlatformFee(
                state.totalSharesLastUpdate,
                state.lastUpdateTimestamp,
                state.platformFee,
                newExchangeRate,
                currentExchangeRate,
                currentTotalShares,
                currentTime
            );

        // Account for performance fees.
        if (newExchangeRate > state.highwaterMark) {
            (uint256 performanceFeesOwedInBase, ) = _calculatePerformanceFee(
                newExchangeRate,
                shareSupplyToUse,
                state.highwaterMark,
                state.performanceFee
            );

            // Add performance fees to fees owed.
            newFeesOwedInBase += performanceFeesOwedInBase;

            // Always update the highwater mark if the new exchange rate is higher.
            // This way if we are not initially taking performance fees, we can start taking them
            // without back charging them on past performance.
            state.highwaterMark = newExchangeRate;
        }

        state.feesOwedInBase += uint128(newFeesOwedInBase);
    }
}
