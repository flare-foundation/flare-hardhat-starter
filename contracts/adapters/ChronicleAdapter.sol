// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {FtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

/**
 * @title FtsoChronicleAdapterLibrary
 * @notice A stateless library with logic to adapt FTSO prices to the Chronicle Protocol format.
 * @dev All state is managed by the contract that uses this library.
 */
library FtsoChronicleAdapterLibrary {
    // This struct defines the cached data that the consuming contract MUST store.
    struct DataPoint {
        uint256 value; // Value scaled to 18 decimals
        uint256 timestamp;
    }

    event Refreshed(bytes21 indexed feedId, uint256 value, uint256 timestamp);

    // Chronicle convention is often 18 decimals for crypto assets.
    uint8 private constant CHRONICLE_DECIMALS = 18;

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

        // Scale the value to the standard 18 decimals for Chronicle compatibility.
        uint256 scaledValue = _scaleValue(
            rawValue,
            ftsoDecimals,
            int8(CHRONICLE_DECIMALS)
        );

        // Directly modify the state of the calling contract.
        _latestState.value = scaledValue;
        _latestState.timestamp = ts;

        emit Refreshed(_ftsoFeedId, scaledValue, ts);
    }

    /**
     * @notice Reads the cached price, reverting if it's not set.
     */
    function read(
        DataPoint storage _latestState
    ) internal view returns (uint256) {
        require(_latestState.timestamp != 0, "Chronicle: No value set");
        return _latestState.value;
    }

    /**
     * @notice Reads the cached price and its age, reverting if not set.
     */
    function readWithAge(
        DataPoint storage _latestState
    ) internal view returns (uint256, uint256) {
        require(_latestState.timestamp != 0, "Chronicle: No value set");
        return (_latestState.value, block.timestamp - _latestState.timestamp);
    }

    /**
     * @notice Safely reads the cached price without reverting.
     */
    function tryRead(
        DataPoint storage _latestState
    ) internal view returns (bool, uint256) {
        if (_latestState.timestamp == 0) {
            return (false, 0);
        }
        return (true, _latestState.value);
    }

    /**
     * @notice Safely reads the cached price and its age without reverting.
     */
    function tryReadWithAge(
        DataPoint storage _latestState
    ) internal view returns (bool, uint256, uint256) {
        if (_latestState.timestamp == 0) {
            return (false, 0, 0);
        }
        return (
            true,
            _latestState.value,
            block.timestamp - _latestState.timestamp
        );
    }

    function _scaleValue(
        uint256 value,
        int8 fromDecimals,
        int8 toDecimals
    ) private pure returns (uint256) {
        if (fromDecimals == toDecimals) return value;
        if (fromDecimals < toDecimals) {
            return value * (10 ** uint256(uint8(toDecimals - fromDecimals)));
        } else {
            return value / (10 ** uint256(uint8(fromDecimals - toDecimals)));
        }
    }
}
