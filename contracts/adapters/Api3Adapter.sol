// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {FtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

/**
 * @title FtsoApi3AdapterLibrary
 * @notice A stateless library containing the logic to adapt FTSO prices to the API3 format.
 * @dev All state is managed by the contract that uses this library.
 */
library FtsoApi3AdapterLibrary {
    // The struct defining the cached data that the consuming contract MUST store.
    struct DataPoint {
        int224 value;
        uint32 timestamp;
    }

    event Refreshed(
        bytes21 indexed feedId,
        int224 scaledValue,
        uint32 timestamp
    );

    uint8 private constant API3_DECIMALS = 18;

    /**
     * @notice Fetches a price from the FTSO and updates the provided storage variable.
     * @param _latestState A storage pointer to the DataPoint struct in the calling contract.
     * @param _ftsoFeedId The FTSO feed ID to query.
     */
    function refresh(
        DataPoint storage _latestState,
        bytes21 _ftsoFeedId
    ) internal {
        FtsoV2Interface ftsoV2 = ContractRegistry.getFtsoV2();
        (uint256 rawValue, int8 ftsoDecimals, uint64 ts) = ftsoV2.getFeedById(
            _ftsoFeedId
        );
        require(ts != 0, "FTSO_NO_DATA");

        int256 scaled = _scaleValue(
            int256(rawValue),
            ftsoDecimals,
            int8(API3_DECIMALS)
        );

        _latestState.value = int224(scaled);
        _latestState.timestamp = uint32(ts);

        emit Refreshed(_ftsoFeedId, _latestState.value, _latestState.timestamp);
    }

    /**
     * @notice Reads and validates the cached price data from the provided storage variable.
     */
    function read(
        DataPoint storage _latestState,
        uint256 _maxAgeSeconds
    ) internal view returns (int224, uint32) {
        require(_latestState.timestamp != 0, "NO_DATA");
        if (_maxAgeSeconds > 0) {
            require(
                block.timestamp - _latestState.timestamp <= _maxAgeSeconds,
                "STALE"
            );
        }
        return (_latestState.value, _latestState.timestamp);
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
