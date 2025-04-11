// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// Interface for the PriceVerifier contract providing the source data
import {IPriceVerifier} from "../fdcExample/PriceVerifier.sol";

// The internal interface required for FTSO Custom Feeds (Based on FIP.13 description)
// NOTE: You should import the actual IICustomFeed interface from the Flare Network contracts library
// once it's available or confirmed. This is a likely structure based on FIP.13.
interface IICustomFeed {

    /**
     * Returns the feed id.
     * @return _feedId The feed id.
     */
    function feedId() external view returns (bytes21 _feedId);

    /**
     * Returns the current feed.
     * @return _value The value of the feed.
     * @return _decimals The decimals of the feed.
     * @return _timestamp The timestamp of the feed.
     */
    function getCurrentFeed() external payable returns (uint256 _value, int8 _decimals, uint64 _timestamp);

    /**
     * Calculates the fee for fetching the feed.
     * @return _fee The fee for fetching the feed.
     */
    function calculateFee() external view returns (uint256 _fee);
}

/**
 * @title PriceVerifierCustomFeed
 * @notice An FTSO Custom Feed contract that sources its value from a PriceVerifier contract.
 * @dev Implements the IICustomFeed interface to be compatible with the FTSO system.
 */
contract PriceVerifierCustomFeed is IICustomFeed {

    // The PriceVerifier contract instance that holds the latest FDC-verified price
    IPriceVerifier public immutable priceVerifier;

    // The unique identifier for this custom feed. Assigned during deployment.
    bytes21 public immutable feedIdentifier; // Renamed for clarity and made immutable

    // Define the decimals for this feed. Since PriceVerifier stores price in USD cents, decimals = 2.
    // This information is crucial for interpreting the feed's value correctly.
    int8 public constant DECIMALS = 2; // Changed to int8 to match IICustomFeed interface

    // Custom error for zero address initialization
    error ZeroAddress();
    // Custom error for invalid feed ID initialization
    error InvalidFeedId();

    /**
     * @notice Constructor initializes the feed with the PriceVerifier contract address and the feed ID.
     * @param _priceVerifierAddress The address of the deployed PriceVerifier contract.
     * @param _feedId The unique identifier for this feed (must not be zero).
     */
    constructor(address _priceVerifierAddress, bytes21 _feedId) {
        if (_priceVerifierAddress == address(0)) {
            revert ZeroAddress();
        }
        // Check if the feed ID is zero (invalid)
        if (_feedId == bytes21(0)) {
            revert InvalidFeedId();
        }

        priceVerifier = IPriceVerifier(_priceVerifierAddress);
        feedIdentifier = _feedId; // Store the feed ID
    }

    /**
     * @notice Reads the latest price from the configured PriceVerifier contract.
     * @dev This is a helper function used by getCurrentFeed. It's not part of the IICustomFeed interface directly.
     * @return value The latest price obtained from PriceVerifier (in USD cents).
     */
    function read() public view returns (uint256 value) {
        // Fetch the latest verified price directly from the PriceVerifier contract.
        // This price originates from an FDC proof verification process.
        value = priceVerifier.getLatestPrice();
        // Note: The value returned is in USD cents, as defined in PriceVerifier.sol (line 10).
        // The DECIMALS constant (2) should be used by consumers of this feed.
    }

    /**
     * @notice Returns the feed id.
     * @dev Implements the IICustomFeed interface requirement.
     * @return _feedId The feed id assigned during deployment.
     */
    function feedId() external view override returns (bytes21 _feedId) {
        _feedId = feedIdentifier; // Return the stored feed ID
    }

    /**
     * @notice Returns the current feed value, decimals, and timestamp.
     * @dev Implements the IICustomFeed interface requirement.
     *      It's called by the FTSO system or consumers to get the feed's current state.
     *      Uses the internal `read()` function to get the value.
     *      Uses `block.timestamp` as the timestamp; in a real scenario, this might need refinement
     *      based on when the PriceVerifier data was actually updated (e.g., reading a timestamp from PriceVerifier if available).
     * @return _value The latest price obtained from PriceVerifier (in USD cents).
     * @return _decimals The number of decimal places for the price value (always 2).
     * @return _timestamp The timestamp when this function was called (approximates data freshness).
     */
    function getCurrentFeed() external payable override returns (uint256 _value, int8 _decimals, uint64 _timestamp) {
        _value = read();
        _decimals = DECIMALS;
        _timestamp = uint64(block.timestamp); // Use current block timestamp
        // Note: The interface requires this function to be payable, even if no fee is collected here.
    }

    /**
     * @notice Calculates the fee for fetching the feed.
     * @dev Implements the IICustomFeed interface requirement.
     *      Returns 0 for this example, assuming no fee is charged.
     * @return _fee The fee (0).
     */
    function calculateFee() external view override returns (uint256 _fee) {
        // For this example, we assume no fee is required to fetch the feed.
        // In a real implementation, this could calculate a dynamic fee based on gas costs or other factors.
        return 0;
    }

    /**
     * @notice Helper function to explicitly return the decimals for this feed.
     * @dev While decimals are returned by getCurrentFeed, this provides an
     *      alternative on-chain way to verify them. It's not part of IICustomFeed.
     * @return The number of decimal places for the price value (always 2 for USD cents).
     */
    function decimals() external pure returns (int8) { // Changed to int8
         return DECIMALS;
    }
} 