// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IFdcVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IFdcVerification.sol"; // Needed for auxiliary verification contract interface
import {IJsonApi} from "@flarenetwork/flare-periphery-contracts/coston2/IJsonApi.sol";

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

// Updated struct to include the symbol and timestamp
struct PriceData {
    string symbol; // e.g., "BTC"
    uint256 price; // e.g., 1660444 (for $16604.44)
    uint64 timestamp; // Unix timestamp of when the price was valid
}

/**
 * @title PriceVerifierCustomFeed
 * @notice An FTSO Custom Feed contract that sources its value from FDC-verified data.
 * @dev Implements the IICustomFeed interface and includes verification logic.
 */
contract PriceVerifierCustomFeed is IICustomFeed {

    // --- State Variables ---

    // The unique identifier for this custom feed. Assigned during deployment.
    bytes21 public feedIdentifier;

    // The symbol this feed is expected to represent (e.g., "BTC"). Set at deployment.
    string public expectedSymbol;

    // Define the decimals for this feed. Price is stored in USD cents, decimals = 2.
    int8 public constant DECIMALS = 2;

    // Stores the latest price verified via FDC proof (from PriceVerifier.sol)
    uint256 public latestVerifiedPrice;

    // Stores the timestamp associated with the latest verified price
    uint64 public latestVerifiedTimestamp; // <-- Added timestamp state variable

    // --- Events ---

    // Event emitted when a new price is verified (from PriceVerifier.sol)
    event PriceVerified(string symbol, uint256 price, uint64 timestamp); // <-- Added timestamp to event

    // --- Errors ---

    error InvalidFeedId();
    error InvalidSymbol(); // <-- Added error
    error ProofSymbolMismatch(); // <-- Added error

    // --- Constructor ---

    /**
     * @notice Constructor initializes the feed with the feed ID and expected symbol.
     * @param _feedId The unique identifier for this feed (must not be zero).
     * @param _expectedSymbol The asset symbol this feed should track (e.g., "BTC").
     */
    constructor(bytes21 _feedId, string memory _expectedSymbol) { // <-- Added _expectedSymbol parameter
        // Check if the feed ID is zero (invalid)
        if (_feedId == bytes21(0)) {
            revert InvalidFeedId();
        }
        // Check if the expected symbol is empty
        if (bytes(_expectedSymbol).length == 0) {
            revert InvalidSymbol();
        }

        feedIdentifier = _feedId; // Store the feed ID
        expectedSymbol = _expectedSymbol; // Store the expected symbol
    }

    // --- FDC Verification Logic (from PriceVerifier.sol) ---

    /**
     * @notice Verifies a price proof obtained via FDC JSON API attestation and stores the price.
     * @dev Ensures the proof is valid AND corresponds to the expected asset symbol.
     * @param _proof The proof data structure containing the attestation and response.
     */
    function verifyPrice(IJsonApi.Proof calldata _proof) external /* Removed override */ {
        // 1. FDC Logic: Verify the cryptographic integrity of the proof
        require(
            ContractRegistry.auxiliaryGetIJsonApiVerification().verifyJsonApi(_proof),
            "Invalid JSON API proof"
        );

        // 2. Business Logic: Decode the price data including the timestamp
        // The abi_encoded_data within the proof's response body should match the updated PriceData struct.
        PriceData memory priceData = abi.decode(
            _proof.data.responseBody.abi_encoded_data,
            (PriceData) // <-- Struct now includes timestamp
        );

        // 3. *** ADDED CHECK ***: Verify the symbol within the proof matches the expected symbol for this feed.
        // Use keccak256 for more gas-efficient string comparison.
        require(
            keccak256(abi.encodePacked(priceData.symbol)) == keccak256(abi.encodePacked(expectedSymbol)),
            "ProofSymbolMismatch()" // Use custom error
        );

        // 4. Store the verified price and its timestamp
        latestVerifiedPrice = priceData.price;
        latestVerifiedTimestamp = priceData.timestamp; // <-- Store the timestamp

        emit PriceVerified(priceData.symbol, latestVerifiedPrice, latestVerifiedTimestamp); // <-- Emit timestamp in event
    }

    // --- Custom Feed Logic (IICustomFeed Implementation) ---

    /**
     * @notice Reads the latest verified price stored internally.
     * @dev Helper function used by getCurrentFeed.
     * @return value The latest price obtained from internal storage (in USD cents).
     */
    function read() public view returns (uint256 value) {
        // Fetch the latest verified price directly from internal state.
        value = latestVerifiedPrice; // Changed from priceVerifier.getLatestPrice()
        // Note: The value returned is in USD cents.
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
     * @dev Implements the IICustomFeed interface requirement (payable).
     *      Uses the internal `read()` function to get the value.
     *      Returns the timestamp associated with the verified price.
     * @return _value The latest price obtained from internal storage (in USD cents).
     * @return _decimals The number of decimal places for the price value (always 2).
     * @return _timestamp The timestamp when the price was valid (from the proof).
     */
    function getCurrentFeed() external payable override returns (uint256 _value, int8 _decimals, uint64 _timestamp) {
        _value = read(); // Assumes read() is view or pure
        _decimals = DECIMALS;
        _timestamp = latestVerifiedTimestamp;
    }

    /**
     * @notice Calculates the fee for fetching the feed.
     * @dev Implements the IICustomFeed interface requirement. Returns 0.
     * @return _fee The fee (0).
     */
    function calculateFee() external view override returns (uint256 _fee) {
        return 0;
    }

    // *** ADDED: New view function for off-chain reading ***
    /**
     * @notice Returns the latest verified price, its decimals, and the timestamp it was valid for (view function).
     * @dev Provides a non-payable way to read the feed data, suitable for off-chain calls.
     * @return _value The latest price obtained from internal storage (in USD cents).
     * @return _decimals The number of decimal places for the price value (always 2).
     * @return _timestamp The timestamp when the price was valid (from the proof).
     */
    function getFeedDataView() external view returns (uint256 _value, int8 _decimals, uint64 _timestamp) {
        _value = latestVerifiedPrice; // Directly access state variable
        _decimals = DECIMALS;
        _timestamp = latestVerifiedTimestamp;
    }

    // --- Helper Functions ---

    /**
     * @notice Helper function to explicitly return the decimals for this feed.
     * @return The number of decimal places for the price value (always 2).
     */
    function decimals() external pure returns (int8) {
        return DECIMALS;
    }

    // --- Helper for ABI generation (from PriceVerifier.sol) ---
    // Ensures ABI includes the updated PriceData struct definition.
    function abiPriceDataHack(PriceData calldata) external pure {} // <-- Struct definition updated automatically by compiler
}
