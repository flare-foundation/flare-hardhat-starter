// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IFdcVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IFdcVerification.sol";
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

//
// Only contains the price, as symbol and timestamp are derived from the URL
struct PriceOnlyData {
    uint256 price;
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

    // Stores the latest price verified via FDC proof
    uint256 public latestVerifiedPrice;

    // Stores the timestamp associated with the latest verified price
    uint64 public latestVerifiedTimestamp;

    // --- Events ---

    // Simplified event: Symbol comes from expectedSymbol, timestamp from URL parsing
    event PriceVerified(string symbol, uint256 price, uint64 timestamp, string apiUrl);

    // Optional: Keep or remove this event based on debugging needs
    event UrlParsingCheck(
        string apiUrl,
        string symbolFromUrl,
        uint64 timestampFromUrl,
        uint256 priceFromProof,
        string symbolFromJq
    );

    // --- Errors ---

    error InvalidFeedId();
    error InvalidSymbol();
    error UrlSymbolMismatchExpected(); // New error for URL symbol vs expected symbol mismatch
    error TimestampParsingFailed(); // New error if timestamp parsing yields 0
    error JqSymbolMismatchExpected(); // New error for JQ symbol vs expected symbol mismatch

    // --- Constructor ---

    /**
     * @notice Constructor initializes the feed with the feed ID and expected symbol.
     * @param _feedId The unique identifier for this feed (must not be zero).
     * @param _expectedSymbol The asset symbol this feed should track (e.g., "BTC").
     */
    constructor(bytes21 _feedId, string memory _expectedSymbol) {
        // Check if the feed ID is zero (invalid)
        if (_feedId == bytes21(0)) {
            revert InvalidFeedId();
        }
        // Check if the expected symbol is empty
        if (bytes(_expectedSymbol).length == 0) {
            revert InvalidSymbol();
        }

        feedIdentifier = _feedId;
        expectedSymbol = _expectedSymbol;
    }

    // --- FDC Verification Logic ---

    /**
     * @notice Verifies a price proof obtained via FDC JSON API attestation and stores the price.
     * @dev Ensures the proof is valid AND the API URL within the proof corresponds
     *      to the expected asset symbol for this feed. Parses timestamp from URL.
     * @param _proof The proof data structure containing the attestation and response.
     */
    function verifyPrice(IJsonApi.Proof calldata _proof) external {
        // 1. FDC Logic: Verify the cryptographic integrity of the proof
        require(
            ContractRegistry.auxiliaryGetIJsonApiVerification().verifyJsonApi(_proof),
            "Invalid JSON API proof"
        );

        // 2. Extract API URL, JQ Filter, and Parse relevant data
        string memory apiUrl = _proof.data.requestBody.url;
        string memory jqFilter = _proof.data.requestBody.postprocessJq;
        bytes memory apiUrlBytes = bytes(apiUrl);
        bytes memory jqFilterBytes = bytes(jqFilter); // Convert JQ filter to bytes

        string memory symbolFromUrl = _parseStringParam(apiUrlBytes, "fsym");
        uint256 timestampFromUrlUint256 = _parseUintParam(apiUrlBytes, "ts");
        string memory symbolFromJq = _parseSymbolFromJq(jqFilterBytes); // <-- Parse STRING symbol from JQ

        // Ensure timestamp was parsed correctly and fits in uint64
        require(timestampFromUrlUint256 > 0, "TimestampParsingFailed()");
        require(timestampFromUrlUint256 <= type(uint64).max, "TimestampParsingFailed()"); // Overflow check
        uint64 timestampFromUrl = uint64(timestampFromUrlUint256);

        // 3. Business Logic: Decode ONLY the price from the proof's response body
        PriceOnlyData memory priceData = abi.decode(
            _proof.data.responseBody.abi_encoded_data,
            (PriceOnlyData) // Use the simplified struct
        );

        // Optional: Emit parsing check event
        emit UrlParsingCheck(
            apiUrl,
            symbolFromUrl,
            timestampFromUrl,
            priceData.price,
            symbolFromJq
        );

        // 4. *** CRUCIAL CHECKS ***
        // a) Verify the symbol *parsed from the URL* matches the expected symbol.
        require(
            keccak256(abi.encodePacked(symbolFromUrl)) == keccak256(abi.encodePacked(expectedSymbol)),
            "UrlSymbolMismatchExpected()"
        );

        // b) *** ADDED CHECK ***: Verify the STRING symbol *parsed from the JQ filter* also matches the expected symbol.
        // This ensures the JQ filter is operating on the correct data path within the JSON.
        require(
            keccak256(abi.encodePacked(symbolFromJq)) == keccak256(abi.encodePacked(expectedSymbol)),
            "JqSymbolMismatchExpected()" // Use the new custom error
        );

        // 5. Store the verified price (from decoded data) and timestamp (from parsed URL)
        latestVerifiedPrice = priceData.price;
        latestVerifiedTimestamp = timestampFromUrl; // Store the parsed timestamp

        // 6. Emit the main event
        // Use expectedSymbol as it's confirmed to match both URL and JQ symbols
        emit PriceVerified(expectedSymbol, latestVerifiedPrice, latestVerifiedTimestamp, apiUrl);

        // You now have 'symbolFromJq' (a string) available if needed for other logic.
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

    // View function for off-chain reading
    /**
     * @notice Returns the latest verified price, its decimals, and the timestamp it was valid for (view function).
     * @dev Provides a non-payable way to read the feed data, suitable for off-chain calls.
     * @return _value The latest price obtained from internal storage (in USD cents).
     * @return _decimals The number of decimal places for the price value (always 2).
     * @return _timestamp The timestamp when the price was valid (from the proof).
     */
    function getFeedDataView() external view returns (uint256 _value, int8 _decimals, uint64 _timestamp) {
        _value = latestVerifiedPrice;
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

    // --- Internal Parsing Helper For Security Checks ---

    /**
     * @dev Parses an unsigned integer value for a given parameter name from URL bytes.
     * Searches for "?param=" or "&param=". Returns 0 if not found or not a valid number.
     * NOTE: Minimal code, not gas-optimized. Does not handle uint64 overflow specifically for 'ts'.
     * @param _data The URL bytes.
     * @param _paramName The name of the parameter (e.g., "price", "ts").
     * @return value The parsed uint256 value, or 0 if not found/parsed.
     */
    function _parseUintParam(bytes memory _data, string memory _paramName) internal pure returns (uint256 value) {
        bytes memory paramBytes = bytes(_paramName);
        // Create search keys like "?price=" and "&price="
        bytes memory key1 = abi.encodePacked("?", paramBytes, "=");
        bytes memory key2 = abi.encodePacked("&", paramBytes, "=");
        uint256 dataLen = _data.length;
        uint256 key1Len = key1.length;
        uint256 key2Len = key2.length;
        uint256 startIndex = 0; // Index where the number starts

        // Find the start index after the key
        for (uint256 i = 0; i < dataLen; ++i) {
            // *** FIX: Renamed 'match' to 'foundMatch' ***
            bool foundMatch = false;
            uint keyLen = 0;
            // Check for ?key=
            if (i + key1Len <= dataLen) {
                foundMatch = true; // Assume match initially
                for (uint256 j = 0; j < key1Len; ++j) {
                    if (_data[i + j] != key1[j]) {
                        foundMatch = false; // Not a match
                        break;
                    }
                }
                if (foundMatch) keyLen = key1Len;
            }
            // Check for &key= if ?key= didn't match
            if (!foundMatch && i + key2Len <= dataLen) {
                 foundMatch = true; // Assume match initially
                 for (uint256 j = 0; j < key2Len; ++j) {
                     if (_data[i + j] != key2[j]) {
                         foundMatch = false; // Not a match
                         break;
                     }
                 }
                 if (foundMatch) keyLen = key2Len;
            }

            if (foundMatch) {
                startIndex = i + keyLen;
                break; // Found the key, exit search loop
            }
             // Optimization: Stop early if remaining data is too short
            if (dataLen - i < key2Len && dataLen - i < key1Len) break;
        }

        // If key was found (startIndex > 0), parse the number
        if (startIndex > 0) {
            for (uint256 i = startIndex; i < dataLen; ++i) {
                bytes1 char = _data[i];
                if (char >= bytes1("0") && char <= bytes1("9")) {
                    // Implicit overflow check in Solidity >= 0.8.0
                    value = value * 10 + (uint8(char) - uint8(bytes1("0")));
                } else {
                    break; // Stop at first non-digit
                }
            }
        }
        // Returns calculated value, or 0 if key not found or no digits followed key
    }

    /**
     * @dev Parses a string value for a given parameter name from URL bytes.
     * Searches for "?param=" or "&param=". Returns an empty string if not found.
     * Stops parsing at the first '&' encountered after the value starts, or end of string.
     * NOTE: Minimal code, not gas-optimized. Assumes simple URL structure.
     * @param _data The URL bytes.
     * @param _paramName The name of the parameter (e.g., "fsym").
     * @return value The parsed string value, or "" if not found.
     */
    function _parseStringParam(bytes memory _data, string memory _paramName) internal pure returns (string memory value) {
        bytes memory paramBytes = bytes(_paramName);
        // Create search keys like "?fsym=" and "&fsym="
        bytes memory key1 = abi.encodePacked("?", paramBytes, "=");
        bytes memory key2 = abi.encodePacked("&", paramBytes, "=");
        uint256 dataLen = _data.length;
        uint256 key1Len = key1.length;
        uint256 key2Len = key2.length;
        uint256 startIndex = 0; // Index where the value string starts
        uint256 endIndex = 0;   // Index where the value string ends (exclusive)

        // Find the start index after the key
        for (uint256 i = 0; i < dataLen; ++i) {
            bool foundMatch = false;
            uint keyLen = 0;
            // Check for ?key=
            if (i + key1Len <= dataLen) {
                foundMatch = true;
                for (uint256 j = 0; j < key1Len; ++j) { if (_data[i + j] != key1[j]) { foundMatch = false; break; } }
                if (foundMatch) keyLen = key1Len;
            }
            // Check for &key= if ?key= didn't match
            if (!foundMatch && i + key2Len <= dataLen) {
                 foundMatch = true;
                 for (uint256 j = 0; j < key2Len; ++j) { if (_data[i + j] != key2[j]) { foundMatch = false; break; } }
                 if (foundMatch) keyLen = key2Len;
            }

            if (foundMatch) {
                startIndex = i + keyLen;
                break;
            }
             // Optimization: Stop early
            if (dataLen - i < key2Len && dataLen - i < key1Len) break;
        }

        // If key was found (startIndex > 0), find the end of the value
        if (startIndex > 0) {
            endIndex = dataLen; // Assume it goes to the end initially
            for (uint256 i = startIndex; i < dataLen; ++i) {
                if (_data[i] == bytes1("&")) {
                    endIndex = i; // Found the end delimiter
                    break;
                }
            }

            // Extract the substring if endIndex > startIndex
            if (endIndex > startIndex) {
                uint256 valueLen = endIndex - startIndex;
                bytes memory resultBytes = new bytes(valueLen);
                for (uint256 i = 0; i < valueLen; ++i) {
                    resultBytes[i] = _data[startIndex + i];
                }
                value = string(resultBytes);
            } else {
                 // Key found, but value is empty (e.g., "fsym=&...")
                 value = "";
            }
        } else {
             // Key not found
             value = "";
        }
        // Returns extracted string, or "" if key not found or value empty
    }

    /**
     * @dev Parses a multiplier value (expected after '* ') from JQ filter bytes.
     * Searches for "* ". Returns 0 if not found or not a valid number following it.
     * NOTE: Assumes a specific structure like "... * 100 | ...". Minimal validation.
     * @param _jqFilterBytes The JQ filter string as bytes.
     * @return multiplier The parsed uint256 value, or 0 if not found/parsed.
     */
    function _parseMultiplierFromJq(bytes memory _jqFilterBytes) internal pure returns (uint256 multiplier) {
        uint256 filterLen = _jqFilterBytes.length;
        uint256 startIndex = 0; // Index where the number starts

        // Find the start index after "* "
        // We search for the two-byte sequence: '*' followed by ' '
        for (uint256 i = 0; i < filterLen; ++i) {
            // Check if there's enough space for the sequence "* "
            if (i + 1 < filterLen) {
                 if (_jqFilterBytes[i] == bytes1("*") && _jqFilterBytes[i+1] == bytes1(" ")) {
                    startIndex = i + 2; // Number starts after "* "
                    break; // Found the sequence, exit loop
                 }
            } else {
                 // Not enough characters left to possibly contain "* "
                 break;
            }
        }

        // If "* " was found (startIndex > 0), parse the number
        if (startIndex > 0) {
            for (uint256 i = startIndex; i < filterLen; ++i) {
                bytes1 char = _jqFilterBytes[i];
                if (char >= bytes1("0") && char <= bytes1("9")) {
                    // Implicit overflow check in Solidity >= 0.8.0
                    multiplier = multiplier * 10 + (uint8(char) - uint8(bytes1("0")));
                } else {
                    break; // Stop at first non-digit
                }
            }
        }
        // Returns calculated multiplier, or 0 if "* " not found or no digits followed
    }

    /**
     * @dev Parses a symbol (e.g., "BTC") from JQ filter bytes based on the pattern ".{symbol}.USD".
     * Searches for the first '.' and then for '.USD' after it.
     * Returns an empty string if the pattern is not found.
     * NOTE: Assumes a specific JQ structure. Minimal validation.
     * @param _jqFilterBytes The JQ filter string as bytes.
     * @return symbol The parsed string symbol, or "" if not found.
     */
    function _parseSymbolFromJq(bytes memory _jqFilterBytes) internal pure returns (string memory symbol) {
        uint256 filterLen = _jqFilterBytes.length;
        uint256 firstDotIndex = filterLen; // Initialize to invalid index
        uint256 secondDotIndex = filterLen; // Initialize to invalid index

        // 1. Find the index of the first '.'
        for (uint256 i = 0; i < filterLen; ++i) {
            if (_jqFilterBytes[i] == bytes1(".")) {
                firstDotIndex = i;
                break;
            }
        }

        // 2. If first dot found, search for ".USD" starting *after* the first dot
        if (firstDotIndex < filterLen - 1) { // Ensure there's space after the first dot
            // Define the target sequence ".USD"
            bytes memory target = ".USD"; // 4 bytes
            uint targetLen = 4;

            // Start searching from the character after the first dot
            for (uint256 i = firstDotIndex + 1; i < filterLen; ++i) {
                // Check if there's enough space for ".USD"
                if (i + targetLen <= filterLen) {
                    bool foundMatch = true; // <-- Renamed variable
                    for(uint k = 0; k < targetLen; ++k) {
                        if (_jqFilterBytes[i+k] != target[k]) {
                            foundMatch = false; // <-- Renamed variable
                            break;
                        }
                    }
                    if (foundMatch) { // <-- Renamed variable
                        secondDotIndex = i; // Found the '.' of ".USD"
                        break;
                    }
                } else {
                    // Not enough characters left to possibly contain ".USD"
                    break;
                }
            }
        }

        // 3. Extract the symbol if both dots were found correctly
        // Ensure firstDotIndex is before secondDotIndex and there are chars between them
        if (secondDotIndex < filterLen && firstDotIndex < secondDotIndex -1) {
             uint256 symbolStartIndex = firstDotIndex + 1;
             uint256 symbolLen = secondDotIndex - symbolStartIndex;
             bytes memory resultBytes = new bytes(symbolLen);
             for (uint256 i = 0; i < symbolLen; ++i) {
                 resultBytes[i] = _jqFilterBytes[symbolStartIndex + i];
             }
             symbol = string(resultBytes);
        } else {
            // Pattern not found or symbol is empty
            symbol = "";
        }
        // Returns extracted symbol string, or "" if pattern not found
    }

    // --- Helper for ABI generation ---
    // Update to reflect the new struct name
    function abiPriceOnlyDataHack(PriceOnlyData calldata) external pure {}
}
