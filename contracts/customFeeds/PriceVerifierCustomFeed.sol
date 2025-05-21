// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston/ContractRegistry.sol";
import {IFdcVerification} from "@flarenetwork/flare-periphery-contracts/coston/IFdcVerification.sol";
import {IJsonApi} from "@flarenetwork/flare-periphery-contracts/coston/IJsonApi.sol";
import {IICustomFeed} from "@flarenetwork/flare-periphery-contracts/coston/customFeeds/interface/IICustomFeed.sol";

struct PriceOnlyData {
    uint256 price;
}

/**
 * @title PriceVerifierCustomFeed
 * @notice An FTSO Custom Feed contract that sources its value from FDC-verified data using CoinGecko.
 * @dev Implements the IICustomFeed interface and includes verification logic specific to CoinGecko API structure.
 */
contract PriceVerifierCustomFeed is IICustomFeed {
    // --- State Variables ---

    bytes21 public immutable feedIdentifier;
    string public expectedSymbol;
    int8 public constant DECIMALS = 2;
    uint256 public latestVerifiedPrice;

    address public owner;
    mapping(bytes32 => string) public symbolToCoinGeckoId;

    // --- Events ---
    event PriceVerified(string indexed symbol, uint256 price, string apiUrl);
    event UrlParsingCheck(string apiUrl, string coinGeckoId, string dateString);
    event CoinGeckoIdMappingSet(bytes32 indexed symbolHash, string coinGeckoId);

    // --- Errors ---
    error InvalidFeedId();
    error InvalidSymbol();
    error UrlCoinGeckoIdMismatchExpected();
    error CoinGeckoIdParsingFailed();
    error UnknownSymbolForCoinGeckoId(); // Kept for direct call if needed, but mapping is primary
    error CoinGeckoIdNotMapped(string symbol);
    error DateStringParsingFailed();
    error NotOwner();

    // --- Modifiers ---
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // --- Constructor ---
    constructor(bytes21 _feedId, string memory _expectedSymbol) {
        if (_feedId == bytes21(0)) revert InvalidFeedId();
        if (bytes(_expectedSymbol).length == 0) revert InvalidSymbol();

        owner = msg.sender;
        feedIdentifier = _feedId;
        expectedSymbol = _expectedSymbol;

        // Initialize default CoinGecko IDs
        _setCoinGeckoIdInternal("BTC", "bitcoin");
        _setCoinGeckoIdInternal("ETH", "ethereum");

        // Ensure the expected symbol has a mapping at deployment time
        require(
            bytes(
                symbolToCoinGeckoId[
                    keccak256(abi.encodePacked(_expectedSymbol))
                ]
            ).length > 0,
            "Initial symbol not mapped"
        );
    }

    // --- Owner Functions ---
    /**
     * @notice Allows the owner to add or update a CoinGecko ID mapping for a symbol.
     * @param _symbol The trading symbol (e.g., "LTC").
     * @param _coinGeckoId The corresponding CoinGecko ID (e.g., "litecoin").
     */
    function setCoinGeckoIdMapping(
        string calldata _symbol,
        string calldata _coinGeckoId
    ) external onlyOwner {
        _setCoinGeckoIdInternal(_symbol, _coinGeckoId);
    }

    function _setCoinGeckoIdInternal(
        string memory _symbol,
        string memory _coinGeckoId
    ) internal {
        require(bytes(_symbol).length > 0, "Symbol cannot be empty");
        require(bytes(_coinGeckoId).length > 0, "CoinGecko ID cannot be empty");
        bytes32 symbolHash = keccak256(abi.encodePacked(_symbol));
        symbolToCoinGeckoId[symbolHash] = _coinGeckoId;
        emit CoinGeckoIdMappingSet(symbolHash, _coinGeckoId);
    }

    // --- FDC Verification Logic ---
    /**
     * @notice Verifies a CoinGecko price proof obtained via FDC JSON API attestation and stores the price.
     * @dev Ensures the proof is valid AND the CoinGecko ID in the API URL path within the proof
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

        // 2. Extract API URL and Parse CoinGecko ID and Date String
        string memory apiUrl = _proof.data.requestBody.url;
        bytes memory apiUrlBytes = bytes(apiUrl);
        (
            string memory coinGeckoIdFromUrl,
            string memory dateStringFromUrl
        ) = _parseUrlData(apiUrlBytes);

        // Check if parsing succeeded
        require(
            bytes(coinGeckoIdFromUrl).length > 0,
            "CoinGeckoIdParsingFailed()"
        );
        require(
            bytes(dateStringFromUrl).length > 0,
            "DateStringParsingFailed()"
        );

        // 3. Decode Price Data (relies on correct JQ filter in the *script*)
        PriceOnlyData memory priceData = abi.decode(
            _proof.data.responseBody.abi_encoded_data,
            (PriceOnlyData)
        );

        // Emit parsing check event using parsed date string
        emit UrlParsingCheck(apiUrl, coinGeckoIdFromUrl, dateStringFromUrl);

        // 4. CRUCIAL CHECK: Verify CoinGecko ID matches expected
        string memory expectedCoinGeckoId = _getExpectedCoinGeckoId(
            expectedSymbol
        );
        require(
            keccak256(abi.encodePacked(coinGeckoIdFromUrl)) ==
                keccak256(abi.encodePacked(expectedCoinGeckoId)),
            "UrlCoinGeckoIdMismatchExpected()"
        );

        // 5. Store verified price
        latestVerifiedPrice = priceData.price;

        // 6. Emit main event
        emit PriceVerified(expectedSymbol, latestVerifiedPrice, apiUrl);
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
        _timestamp = 0;
    }

    function decimals() external pure returns (int8) {
        return DECIMALS;
    }

    // --- Internal Helper Functions To Parse URL---

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
            return type(uint256).max; // Marker is empty or data too short
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
                return i; // Return the starting index of the marker
            }
        }
        return type(uint256).max; // Marker not found
    }

    /**
     * @notice Parses the CoinGecko ID and date string from the API URL.
     * Assumes URL format like: https://api.coingecko.com/api/v3/coins/{ID}/history?date={DATE}&localization=false
     * @param apiUrlBytes The API URL as bytes.
     * @return coinGeckoId The parsed CoinGecko ID (e.g., "bitcoin").
     * @return dateString The parsed date string (e.g., "30-12-2022").
     */
    function _parseUrlData(
        bytes memory apiUrlBytes
    )
        internal
        pure
        returns (string memory coinGeckoId, string memory dateString)
    {
        // Define markers
        bytes memory coinsMarker = bytes("/coins/");
        bytes memory historyMarker = bytes("/history");
        bytes memory dateMarker = bytes("?date=");
        bytes memory endMarker = bytes("&");

        uint256 idStartIndex = _findMarker(apiUrlBytes, coinsMarker, 0);
        if (idStartIndex == type(uint256).max) return ("", "");

        uint256 idStart = idStartIndex + coinsMarker.length;
        uint256 idEndIndex = _findMarker(apiUrlBytes, historyMarker, idStart);
        if (idEndIndex == type(uint256).max) return ("", "");

        uint256 dateStartIndex = _findMarker(
            apiUrlBytes,
            dateMarker,
            idEndIndex
        );
        if (dateStartIndex == type(uint256).max) return ("", "");

        uint256 dateStart = dateStartIndex + dateMarker.length;
        uint256 dateEndIndex = _findMarker(apiUrlBytes, endMarker, dateStart);

        if (dateEndIndex == type(uint256).max) {
            dateEndIndex = apiUrlBytes.length;
        }

        coinGeckoId = string(slice(apiUrlBytes, idStart, idEndIndex));
        dateString = string(slice(apiUrlBytes, dateStart, dateEndIndex));
    }

    /**
     * @notice Maps a trading symbol (e.g., "BTC") to its corresponding CoinGecko ID (e.g., "bitcoin").
     * @dev Uses the symbolToCoinGeckoId mapping.
     * @param _symbol The trading symbol (e.g., "BTC", "ETH").
     * @return The CoinGecko ID string (e.g., "bitcoin", "ethereum").
     */
    function _getExpectedCoinGeckoId(
        string memory _symbol
    ) internal view returns (string memory) {
        bytes32 symbolHash = keccak256(abi.encodePacked(_symbol));
        string memory coinGeckoId = symbolToCoinGeckoId[symbolHash];
        if (bytes(coinGeckoId).length == 0) {
            revert CoinGeckoIdNotMapped(_symbol);
        }
        return coinGeckoId;
    }
}
