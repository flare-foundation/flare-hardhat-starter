// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IRateProvider } from "../interfaces/IRateProvider.sol";
import { TestFtsoV2Interface } from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";
import { ContractRegistry } from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

/**
 * @title FTSOv2RateProvider
 * @notice Rate provider that fetches prices from Flare's FTSOv2 Block Latency Feeds
 * @dev Implements IRateProvider interface for use with AccountantWithRateProviders
 *
 * FTSOv2 Block Latency Feeds:
 * - ✅ Updates EVERY BLOCK (~1.8 seconds on Flare!)
 * - ✅ 61+ crypto price feeds available
 * - ✅ Decentralized (100 independent data providers)
 * - ✅ Completely FREE to query
 * - ✅ Sub-second price updates via incremental deltas
 *
 * This is the CORRECT FTSOv2 implementation (not the old FTSOv1 3-minute feeds!)
 *
 * Example Usage:
 * ```solidity
 * // Deploy for BTC/USD feed
 * FTSOv2RateProvider btcProvider = new FTSOv2RateProvider(
 *     FAST_UPDATER_ADDRESS,
 *     0x014254432f555344000000000000000000000000, // BTC/USD feed ID
 *     8,  // BTC has 8 decimals
 *     18  // Rate decimals (match base asset)
 * );
 *
 * // Use in Accountant
 * accountant.setRateProviderData(
 *     WBTC_ADDRESS,
 *     false,              // NOT pegged
 *     address(btcProvider) // Use FTSOv2 oracle
 * );
 * ```
 */
contract FTSOv2RateProvider is IRateProvider {
    // ========================================= STATE =========================================

    /**
     * @notice Feed ID to query (e.g., 0x014254432f555344... for BTC/USD)
     * @dev Feed IDs are bytes21 identifiers for specific price pairs
     * @dev Common feed IDs (Coston2):
     *   - FLR/USD: 0x01464c522f555344000000000000000000000000
     *   - BTC/USD: 0x014254432f555344000000000000000000000000
     *   - ETH/USD: 0x014554482f555344000000000000000000000000
     */
    bytes21 public immutable feedId;

    /**
     * @notice Target decimals for the returned rate
     * @dev Should match AccountantWithRateProviders base asset decimals
     */
    uint8 public immutable rateDecimals;

    // ========================================= ERRORS =========================================

    error FTSOv2RateProvider__ZeroFeedId();
    error FTSOv2RateProvider__InvalidPrice();

    // ========================================= CONSTRUCTOR =========================================

    /**
     * @notice Initialize FTSOv2 Rate Provider
     * @param _feedId Feed ID to track (e.g., 0x014254432f555344... for BTC/USD)
     * @param _rateDecimals Decimals for returned rate (match base asset)
     */
    constructor(bytes21 _feedId, uint8 _rateDecimals) {
        if (_feedId == bytes21(0)) revert FTSOv2RateProvider__ZeroFeedId();

        feedId = _feedId;
        rateDecimals = _rateDecimals;
    }

    // ========================================= RATE PROVIDER =========================================

    /**
     * @notice Get current exchange rate from FTSOv2
     * @dev Implements IRateProvider.getRate()
     * @return rate Current price scaled to rateDecimals
     *
     * Example for BTC/USD at $65,000:
     * - FTSOv2 returns: value=6500000, decimals=-2 (means 65000.00)
     * - rateDecimals=18
     * - Final rate: 65000 * 10^18 = 65000000000000000000000
     *
     * How FTSOv2 Decimals Work:
     * - Negative decimals mean divide: decimals=-2 → value/100
     * - Positive decimals mean multiply: decimals=2 → value*100
     * - Zero decimals mean no scaling: decimals=0 → value
     */
    function getRate() external view override returns (uint256 rate) {
        // Fetch price from FTSOv2
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();

        (uint256 value, int8 decimals, ) = ftsoV2.getFeedById(feedId);

        // Validate response
        if (value == 0) revert FTSOv2RateProvider__InvalidPrice();

        // Scale feed value based on FTSOv2 decimals to rate decimals
        rate = _scalePrice(value, decimals, rateDecimals);
    }

    /**
     * @notice Get current feed data with metadata
     * @return value Current price value
     * @return feedDecimals FTSOv2 decimal modifier
     * @return timestamp Last update time
     */
    function getCurrentFeedData() external view returns (uint256 value, int8 feedDecimals, uint64 timestamp) {
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        (value, feedDecimals, timestamp) = ftsoV2.getFeedById(feedId);
    }

    // ========================================= INTERNAL =========================================

    /**
     * @notice Scale price from FTSO decimals to target decimals
     * @param value Price value from FTSO
     * @param ftsoDecimals FTSO decimal modifier (can be negative!)
     * @param toDecimals Target decimals
     * @return Scaled price
     *
     * FTSOv2 Decimal Examples:
     * - BTC/USD = 65000, decimals = -2 → 65000 / 100 = 650.00 → $65,000
     * - ETH/USD = 3500, decimals = 0 → 3500 → $3,500
     * - Small value = 1234, decimals = 2 → 1234 * 100 = 123,400
     */
    function _scalePrice(uint256 value, int8 ftsoDecimals, uint8 toDecimals) internal pure returns (uint256) {
        // First, convert FTSO value to a standard base
        uint256 baseValue;

        if (ftsoDecimals == 0) {
            baseValue = value;
        } else if (ftsoDecimals > 0) {
            // Positive: multiply
            baseValue = value * (10 ** uint8(ftsoDecimals));
        } else {
            // Negative: divide
            baseValue = value / (10 ** uint8(-ftsoDecimals));
        }

        // Then scale to target decimals
        return baseValue * (10 ** toDecimals);
    }
}
