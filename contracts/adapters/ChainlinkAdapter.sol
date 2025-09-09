// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {FtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

/**
 * @title FtsoChainlinkAdapterLibrary
 * @notice A stateless library containing the logic to adapt FTSO prices to the Chainlink format.
 * @dev All state is managed by the contract that uses this library.
 */
library FtsoChainlinkAdapterLibrary {
    // This struct defines the shape of the cached data that the consuming contract MUST store.
    struct Round {
        int256 answer;
        uint256 startedAt;
        uint256 updatedAt;
        uint80 answeredInRound;
        uint80 roundId;
    }

    event Refreshed(
        bytes21 indexed feedId,
        int256 scaledAnswer,
        uint64 ftsoTimestamp,
        uint8 ftsoDecimals,
        uint80 roundId
    );

    /**
     * @notice Fetches a price from the FTSO and updates the provided storage variable.
     * @param _latestState A storage pointer to the Round struct in the calling contract.
     * @param _ftsoFeedId The FTSO feed ID to query.
     * @param _chainlinkDecimals The target number of decimals for the Chainlink format.
     */
    function refresh(
        Round storage _latestState,
        bytes21 _ftsoFeedId,
        uint8 _chainlinkDecimals
    ) internal {
        FtsoV2Interface ftsoV2 = ContractRegistry.getFtsoV2();
        (uint256 rawValue, int8 ftsoDecimals, uint64 ts) = ftsoV2.getFeedById(
            _ftsoFeedId
        );
        require(ts != 0, "FTSO_NO_DATA");

        int256 scaled = _scaleValue(
            int256(rawValue),
            ftsoDecimals,
            int8(_chainlinkDecimals)
        );
        uint80 rid = uint80(ts);

        // Directly modify the state of the calling contract
        _latestState.answer = scaled;
        _latestState.startedAt = ts;
        _latestState.updatedAt = ts;
        _latestState.answeredInRound = rid;
        _latestState.roundId = rid;

        emit Refreshed(_ftsoFeedId, scaled, ts, uint8(ftsoDecimals), rid);
    }

    /**
     * @notice Reads and validates the cached price data from the provided storage variable.
     */
    function latestRoundData(
        Round storage _latestState,
        uint256 _maxAgeSeconds
    ) internal view returns (uint80, int256, uint256, uint256, uint80) {
        require(_latestState.updatedAt != 0, "NO_DATA");
        if (_maxAgeSeconds > 0) {
            require(
                block.timestamp - _latestState.updatedAt <= _maxAgeSeconds,
                "STALE"
            );
        }
        return (
            _latestState.roundId,
            _latestState.answer,
            _latestState.startedAt,
            _latestState.updatedAt,
            _latestState.answeredInRound
        );
    }

    function _scaleValue(
        int256 value,
        int8 fromDecimals,
        int8 toDecimals
    ) private pure returns (int256) {
        if (fromDecimals == toDecimals) return value;
        if (fromDecimals < toDecimals) {
            return
                value * int256(10 ** uint256(uint8(toDecimals - fromDecimals)));
        } else {
            return
                value / int256(10 ** uint256(uint8(fromDecimals - toDecimals)));
        }
    }
}
