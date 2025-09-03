// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {TestFtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

/**
 * @title IApi3ReaderProxy
 * @notice Interface for the API3 data feed proxy contract.
 * @dev This is the standard interface for reading dAPIs as per the official API3 documentation.
 * https://docs.api3.org/dapps/integration/contract-integration.html
 */
interface IApi3ReaderProxy {
    /**
     * @notice Reads the latest data feed value.
     * @return value The latest value of the data feed.
     * @return timestamp The timestamp of the latest value.
     */
    function read() external view returns (int224 value, uint32 timestamp);
}

/**
 * @title FtsoApi3AdapterBase
 * @notice Exposes Flare FTSOv2 prices through an API3-compatible interface.
 *
 * @dev This contract adapts FTSO price data to the format expected by API3 consumers
 * by implementing the IApi3ReaderProxy interface.
 * - FTSO provides a `value` and `decimals`.
 * - API3 data feeds typically provide a value with 18 decimals.
 * - This adapter scales the FTSO value to 18 decimals to match the API3 convention.
 *
 * IMPORTANT:
 * - API3's `read()` is view, but FTSOv2 may require a fee to read.
 * We are using TestFtsoV2Interface which does not require a fee.
 * - We therefore cache the latest price in storage via `refresh()`, and
 * `read()` returns the cached value.
 *
 * Usage:
 * - Anyone (or your keeper) calls refresh().
 * - API3-integrated consumers call read().
 */
abstract contract FtsoApi3AdapterBase is IApi3ReaderProxy {
    // ---- Immutable configuration ----
    bytes21 internal immutable ftsoFeedId; // e.g. "BTC/USD" => 0x014254432f555344...
    string internal descriptionText; // Human readable, e.g. "FTSOv2 BTC/USD (Coston2)"
    uint256 internal immutable maxAgeSeconds; // Staleness guard for cached price

    // ---- Constants ----
    uint8 private constant API3_DECIMALS = 18;

    // ---- Cached state ----
    struct DataPoint {
        int224 value;
        uint32 timestamp;
    }
    DataPoint private _latest;

    // ---- Events ----
    event Refreshed(
        bytes21 indexed feedId,
        int224 scaledValue,
        uint32 timestamp
    );

    constructor(
        bytes21 _ftsoFeedId,
        string memory _description,
        uint256 _maxAgeSeconds
    ) {
        ftsoFeedId = _ftsoFeedId;
        descriptionText = _description;
        maxAgeSeconds = _maxAgeSeconds;
    }

    // --------- API3 IApi3ReaderProxy Interface ---------

    /**
     * @notice Reads the latest cached data feed value.
     * @return value The latest scaled value of the data feed.
     * @return timestamp The timestamp of the latest value.
     */
    function read() public view virtual override returns (int224, uint32) {
        DataPoint memory d = _latest;
        require(d.timestamp != 0, "NO_DATA");

        // Optional staleness guard for consumers relying solely on this call
        if (maxAgeSeconds > 0) {
            require(block.timestamp - d.timestamp <= maxAgeSeconds, "STALE");
        }
        return (d.value, d.timestamp);
    }

    // --------- Refresh path ---------

    /**
     * @notice Pulls fresh data from FTSOv2 and caches a scaled value.
     * @dev Anyone can call this function to update the price.
     */
    function refresh() external {
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();

        // Read FTSO value
        (uint256 rawValue, int8 ftsoDecimals, uint64 ts) = ftsoV2.getFeedById(
            ftsoFeedId
        );
        require(ts != 0, "FTSO_NO_DATA");

        // Scale to API3-style decimals (18)
        int256 scaled = _scaleValue(
            int256(rawValue),
            ftsoDecimals,
            int8(API3_DECIMALS)
        );

        // Cache the latest data point
        _latest = DataPoint({value: int224(scaled), timestamp: uint32(ts)});

        emit Refreshed(ftsoFeedId, _latest.value, _latest.timestamp);
    }

    // --------- Admin niceties (optional, non-critical) ---------

    /**
     * @notice Updates the description text.
     * @param newDesc The new description string.
     */
    function setDescription(string calldata newDesc) external {
        descriptionText = newDesc;
    }

    /**
     * @notice A helper function to view the currently cached data.
     */
    function latestData() external view returns (int224, uint32) {
        return (_latest.value, _latest.timestamp);
    }

    // --------- Internal math ---------
    function _scaleValue(
        int256 value,
        int8 fromDecimals,
        int8 toDecimals
    ) internal pure returns (int256) {
        if (fromDecimals == toDecimals) return value;
        if (fromDecimals < toDecimals) {
            uint256 factor = 10 ** uint256(uint8(toDecimals - fromDecimals));
            return value * int256(factor);
        } else {
            uint256 factor = 10 ** uint256(uint8(fromDecimals - toDecimals));
            return value / int256(factor);
        }
    }
}
