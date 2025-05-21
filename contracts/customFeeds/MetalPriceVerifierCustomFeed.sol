// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston/ContractRegistry.sol";
import {IFdcVerification} from "@flarenetwork/flare-periphery-contracts/coston/IFdcVerification.sol";
import {IJsonApi} from "@flarenetwork/flare-periphery-contracts/coston/IJsonApi.sol";
import {IICustomFeed} from "@flarenetwork/flare-periphery-contracts/coston/customFeeds/interface/IICustomFeed.sol";

struct MetalPriceData {
    uint256 price;
}

/**
 * @title MetalPriceVerifierCustomFeed
 * @notice An FTSO Custom Feed contract that sources its value from FDC-verified data using Swissquote Forex feed.
 * @dev Implements the IICustomFeed interface and includes verification logic specific to the Swissquote API structure.
 */
contract MetalPriceVerifierCustomFeed is IICustomFeed {
    // --- State Variables ---

    bytes21 public immutable feedIdentifier;
    string public expectedSymbol;
    int8 public constant DECIMALS = 4;
    uint256 public latestVerifiedPrice;
    uint64 public latestVerifiedTimestamp;

    // --- Events ---
    event PriceVerified(string indexed symbol, uint256 price, string apiUrl);
    event UrlParsingCheck(string apiUrl, string metalSymbolFromUrl);

    // --- Errors ---
    error InvalidFeedId();
    error InvalidSymbol();
    error UrlMetalSymbolMismatchExpected();
    error MetalSymbolParsingFailed();

    // --- Constructor ---
    constructor(bytes21 _feedId, string memory _expectedSymbol) {
        if (_feedId == bytes21(0)) revert InvalidFeedId();
        if (bytes(_expectedSymbol).length == 0) revert InvalidSymbol();

        feedIdentifier = _feedId;
        expectedSymbol = _expectedSymbol;

        // Check if symbol is supported during construction
        _validateSymbol(_expectedSymbol);
    }

    // --- FDC Verification Logic ---
    /**
     * @notice Verifies a Swissquote metal price proof obtained via FDC JSON API attestation and stores the price.
     * @dev Ensures the proof is valid AND the metal symbol (XAU/XAG/XPT) in the API URL path within the proof
     *      corresponds to the expected asset symbol for this feed. Uses timestamp from proof data.
     * @param _proof The proof data structure containing the attestation and response.
     */
    function verifyPrice(IJsonApi.Proof calldata _proof) external {
        // 1. FDC Verification
        require(
            ContractRegistry.auxiliaryGetIJsonApiVerification().verifyJsonApi(
                _proof
            ),
            "Invalid JSON API proof"
        );

        // 2. Extract API URL and Parse Metal Symbol
        string memory apiUrl = _proof.data.requestBody.url;
        bytes memory apiUrlBytes = bytes(apiUrl);
        string memory metalSymbolFromUrl = _parseUrlForMetalSymbol(apiUrlBytes);

        // Check if parsing succeeded
        require(
            bytes(metalSymbolFromUrl).length > 0,
            "MetalSymbolParsingFailed()"
        );

        // Emit parsing check event
        emit UrlParsingCheck(apiUrl, metalSymbolFromUrl);

        // 3. CRUCIAL CHECK: Verify Metal Symbol matches expected
        require(
            keccak256(abi.encodePacked(metalSymbolFromUrl)) ==
                keccak256(abi.encodePacked(expectedSymbol)),
            "UrlMetalSymbolMismatchExpected()"
        );

        // 4. Decode Price Data (relies on correct JQ filter in the *script*)
        MetalPriceData memory priceData = abi.decode(
            _proof.data.responseBody.abi_encoded_data,
            (MetalPriceData)
        );

        // 5. Store verified price and timestamp
        latestVerifiedPrice = priceData.price;
        // latestVerifiedTimestamp = uint64(_proof.data.timestamp);

        // 6. Emit main event
        // TODO: Add timestamp back in
        emit PriceVerified(
            expectedSymbol,
            latestVerifiedPrice,
            // latestVerifiedTimestamp,
            apiUrl
        );
    }

    // --- Custom Feed Logic ---
    function read() public view returns (uint256 value) {
        value = latestVerifiedPrice;
    }

    function feedId() external view override returns (bytes21 _feedId) {
        _feedId = feedIdentifier;
    }

    function calculateFee() external pure override returns (uint256 _fee) {
        return 0;
    }

    function getFeedDataView()
        external
        view
        returns (uint256 _value, int8 _decimals)
    {
        _value = latestVerifiedPrice;
        _decimals = DECIMALS;
    }

    function getCurrentFeed()
        external
        payable
        override
        returns (uint256 _value, int8 _decimals, uint64 _timestamp)
    {
        _value = latestVerifiedPrice;
        _decimals = DECIMALS;
        _timestamp = latestVerifiedTimestamp;
    }

    function decimals() external pure returns (int8) {
        return DECIMALS;
    }

    // --- Internal Helper Functions ---

    /**
     * @notice Helper function to extract a slice of bytes.
     * @param data The original bytes array.
     * @param start The starting index (inclusive).
     * @param end The ending index (exclusive).
     * @return The sliced bytes.
     */
    function slice(
        bytes memory data,
        uint256 start,
        uint256 end
    ) internal pure returns (bytes memory) {
        require(end >= start, "Slice: end before start");
        require(data.length >= end, "Slice: end out of bounds");
        bytes memory result = new bytes(end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = data[i];
        }
        return result;
    }

    /**
     * @notice Helper function to find the first occurrence of a marker in bytes data.
     * @param data The bytes data to search within.
     * @param marker The bytes marker to find.
     * @param searchStart The index to start searching from.
     * @return The starting index of the marker, or type(uint256).max if not found.
     */
    function _findMarker(
        bytes memory data,
        bytes memory marker,
        uint256 searchStart
    ) internal pure returns (uint256) {
        uint256 dataLen = data.length;
        uint256 markerLen = marker.length;
        if (markerLen == 0 || dataLen < markerLen + searchStart) {
            return type(uint256).max;
        }

        for (uint256 i = searchStart; i <= dataLen - markerLen; i++) {
            bool foundMatch = true;
            for (uint256 j = 0; j < markerLen; j++) {
                if (data[i + j] != marker[j]) {
                    foundMatch = false;
                    break;
                }
            }
            if (foundMatch) {
                return i;
            }
        }
        return type(uint256).max;
    }

    /**
     * @notice Parses the Metal Symbol (XAU, XAG, XPT) from the Swissquote API URL.
     * Assumes URL format like: https://.../instrument/{METAL}/USD
     * @param apiUrlBytes The API URL as bytes.
     * @return metalSymbol The parsed metal symbol (e.g., "XAU").
     */
    function _parseUrlForMetalSymbol(
        bytes memory apiUrlBytes
    ) internal pure returns (string memory metalSymbol) {
        // Define markers
        bytes memory instrumentMarker = bytes("/instrument/");
        bytes memory usdMarker = bytes("/USD");

        uint256 symbolStartIndex = _findMarker(
            apiUrlBytes,
            instrumentMarker,
            0
        );
        if (symbolStartIndex == type(uint256).max) return "";

        uint256 symbolStart = symbolStartIndex + instrumentMarker.length;
        uint256 symbolEndIndex = _findMarker(
            apiUrlBytes,
            usdMarker,
            symbolStart
        );
        if (symbolEndIndex == type(uint256).max) return "";

        // Basic sanity check for symbol length (expecting 3 characters)
        if (symbolEndIndex - symbolStart != 3) {
            return "";
        }

        metalSymbol = string(slice(apiUrlBytes, symbolStart, symbolEndIndex));
    }

    /**
     * @notice Validates if the symbol is one of the supported metals. Reverts otherwise.
     * @param _symbol The symbol to check (e.g., "XAU").
     */
    function _validateSymbol(string memory _symbol) internal pure {
        bytes32 symbolHash = keccak256(abi.encodePacked(_symbol));
        if (
            symbolHash == keccak256(abi.encodePacked("XAU")) ||
            symbolHash == keccak256(abi.encodePacked("XAG")) ||
            symbolHash == keccak256(abi.encodePacked("XPT"))
        ) {
            // Symbol is valid
            return;
        }
        revert InvalidSymbol();
    }
}
