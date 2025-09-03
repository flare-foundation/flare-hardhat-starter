// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {TestFtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

/**
 * @title FtsoChainlinkAdapter
 * @notice Exposes Flare FTSOv2 prices through Chainlink's AggregatorV3Interface.
 *
 * IMPORTANT:
 * - Chainlink's latestRoundData() is view, but FTSOv2 may require a fee to read. We are using TestFtsoV2Interface which does not require a fee.
 * - We therefore cache the latest price in storage via `refresh()`, and
 * `latestRoundData()` returns the cached value.
 *
 * Usage:
 * - Anyone (or your keeper) calls refresh().
 * - CL-integrated consumers keep calling latestRoundData()/decimals()/description().
 */
abstract contract FtsoChainlinkAdapterBase is AggregatorV3Interface {
    // ---- Immutable configuration ----
    bytes21 internal immutable ftsoFeedId; // e.g. "BTC/USD" => 0x014254432f555344... (bytes21)
    uint8 internal immutable chainlinkDecimals; // e.g. 8 to match most CL feeds
    string internal descriptionText; // human readable, e.g. "FTSOv2 BTC/USD (Coston2)"
    uint256 internal immutable maxAgeSeconds; // staleness guard for cached price

    // ---- Cached round state ----
    struct Round {
        int256 answer;
        uint256 startedAt;
        uint256 updatedAt;
        uint80 answeredInRound;
        uint80 roundId;
    }
    Round private _latest;

    // ---- Events ----
    event Refreshed(
        bytes21 indexed feedId,
        int256 scaledAnswer,
        uint64 ftsoTimestamp,
        uint8 ftsoDecimals,
        uint80 roundId
    );

    constructor(
        bytes21 _ftsoFeedId,
        uint8 _chainlinkDecimals,
        string memory _description,
        uint256 _maxAgeSeconds
    ) {
        require(_chainlinkDecimals <= 18, "decimals>18 not supported");
        ftsoFeedId = _ftsoFeedId;
        chainlinkDecimals = _chainlinkDecimals;
        descriptionText = _description;
        maxAgeSeconds = _maxAgeSeconds;
    }

    // --------- Chainlink AggregatorV3Interface ---------

    function decimals() external view virtual override returns (uint8) {
        return chainlinkDecimals;
    }

    function description() external view override returns (string memory) {
        return descriptionText;
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        Round memory r = _latest;
        require(r.updatedAt != 0, "NO_DATA");
        // Optional staleness guard for consumers relying solely on this call
        if (maxAgeSeconds > 0) {
            require(block.timestamp - r.updatedAt <= maxAgeSeconds, "STALE");
        }
        return (
            r.roundId,
            r.answer,
            r.startedAt,
            r.updatedAt,
            r.answeredInRound
        );
    }

    // Minimal historical support: return current if IDs match; otherwise revert.
    function getRoundData(
        uint80 _roundId
    )
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        Round memory r = _latest;
        require(r.updatedAt != 0, "NO_DATA");
        require(_roundId == r.roundId, "HISTORICAL_UNSUPPORTED");
        return (
            r.roundId,
            r.answer,
            r.startedAt,
            r.updatedAt,
            r.answeredInRound
        );
    }

    // --------- Refresh path ---------

    /**
     * @notice Pulls fresh data from FTSOv2 and caches a scaled value.
     * @dev Anyone can call.
     */
    function refresh() external {
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();

        // Read FTSO value (returns integer value, feed decimals, and timestamp)
        (uint256 rawValue, int8 ftsoDecimals, uint64 ts) = ftsoV2.getFeedById(
            ftsoFeedId
        );
        require(ts != 0, "FTSO_NO_DATA");

        // Scale to Chainlink-style decimals
        int256 scaled = _scaleValue(
            int256(rawValue),
            ftsoDecimals,
            int8(chainlinkDecimals)
        );

        // Cache as the "latest round"
        uint80 rid = uint80(ts); // simple round id derived from timestamp
        _latest = Round({
            answer: scaled,
            startedAt: ts, // CL surfaces startedAt; we use same as updatedAt
            updatedAt: ts,
            answeredInRound: rid,
            roundId: rid
        });

        emit Refreshed(ftsoFeedId, scaled, ts, uint8(ftsoDecimals), rid);
    }

    // --------- Admin niceties (optional, non-critical) ---------
    function setDescription(string calldata newDesc) external {
        // optional: make this ownable if you want; left open for simplicity
        descriptionText = newDesc;
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
