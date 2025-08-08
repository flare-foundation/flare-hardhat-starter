// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IWeb2Json} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";
import {IICustomFeed} from "@flarenetwork/flare-periphery-contracts/coston2/customFeeds/interfaces/IICustomFeed.sol";

struct MetalPriceData {
    uint256 price;
}

/**
 * @title MetalPriceVerifierCustomFeed
 * @notice An FTSO Custom Feed contract that sources its value from FDC-verified data using Web2Json.
 * @dev Implements the IICustomFeed interface and includes verification logic specific to the Web2Json API structure.
 */
contract MetalPriceVerifierCustomFeed is IICustomFeed {
    // --- State Variables ---

    bytes21 public immutable feedIdentifier;
    string public expectedSymbol;
    int8 public decimals_ = 4;
    uint256 public latestVerifiedPrice;
    uint64 public latestVerifiedTimestamp;

    // --- Events ---
    event PriceVerified(string indexed symbol, uint256 price, string apiUrl);
    event UrlParsingCheck(string apiUrl, string metalSymbolFromUrl);

    // --- Errors ---
    error InvalidFeedId();
    error InvalidSymbol();
    error InvalidSymbolInUrl(string url, string symbol);
    error InvalidProof();

    // --- Constructor ---
    constructor(bytes21 _feedId, string memory _expectedSymbol) {
        if (_feedId == bytes21(0)) revert InvalidFeedId();
        if (bytes(_expectedSymbol).length == 0) revert InvalidSymbol();

        feedIdentifier = _feedId;
        expectedSymbol = _expectedSymbol;
    }

    // --- FDC Verification & Price Logic ---
    /**
     * @notice Verifies the metal price data proof and stores the price.
     * @dev Uses Web2Json FDC verification. Checks if the symbol in the URL matches expectedSymbol.
     * @param _proof The IWeb2Json.Proof data structure.
     */
    function verifyPrice(IWeb2Json.Proof calldata _proof) external {
        // 1. Symbol Verification (from URL)
        string memory metalSymbolFromUrl = _extractSymbolFromUrl(
            _proof.data.requestBody.url
        );
        emit UrlParsingCheck(_proof.data.requestBody.url, metalSymbolFromUrl); // For debugging URL parsing
        if (
            keccak256(abi.encodePacked(metalSymbolFromUrl)) !=
            keccak256(abi.encodePacked(expectedSymbol))
        ) {
            revert InvalidSymbolInUrl(
                _proof.data.requestBody.url,
                metalSymbolFromUrl
            );
        }

        // 2. FDC Verification (Web2Json)
        require(
            ContractRegistry.getFdcVerification().verifyWeb2Json(_proof),
            "FDC: Invalid Web2Json proof"
        );

        // 3. Decode Price Data
        MetalPriceData memory newPriceData = abi.decode(
            _proof.data.responseBody.abiEncodedData,
            (MetalPriceData)
        );

        // 4. Store verified data
        latestVerifiedPrice = newPriceData.price;

        // 5. Emit main event
        emit PriceVerified(
            expectedSymbol,
            newPriceData.price,
            _proof.data.requestBody.url // URL from the Web2Json proof
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
        _decimals = decimals_;
    }

    function getCurrentFeed()
        external
        payable
        override
        returns (uint256 _value, int8 _decimals, uint64 _timestamp)
    {
        _value = latestVerifiedPrice;
        _decimals = decimals_;
        _timestamp = latestVerifiedTimestamp;
    }

    function decimals() external view returns (int8) {
        return decimals_;
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
     * @notice Extracts the symbol from the URL.
     * @param url The URL to extract the symbol from.
     * @return The extracted symbol.
     */
    function _extractSymbolFromUrl(
        string memory url
    ) internal pure returns (string memory) {
        // Implement symbol extraction logic here
        // For demonstration purposes, assume the symbol is the last part of the URL path
        bytes memory urlBytes = bytes(url);
        uint256 lastSlashIndex = _findMarker(urlBytes, bytes("/"), 0);
        if (lastSlashIndex == type(uint256).max) return "";

        uint256 symbolStart = lastSlashIndex + 1;
        uint256 symbolEnd = urlBytes.length;
        return string(slice(urlBytes, symbolStart, symbolEnd));
    }
}
