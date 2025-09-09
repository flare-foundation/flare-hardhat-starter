// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {FtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/**
 * @title FtsoPythAdapterLibrary
 * @notice A stateless library containing the logic to adapt FTSO prices to the Pyth format.
 * @dev All state is managed by the contract that uses this library.
 */
library FtsoPythAdapterLibrary {
    event Refreshed(
        bytes21 indexed feedId,
        bytes32 indexed priceId,
        int64 price,
        int32 expo,
        uint publishTime
    );

    /**
     * @notice Fetches a price from the FTSO and updates the provided storage variable.
     * @param _latestPrice A storage pointer to the Price struct in the calling contract.
     * @param _ftsoFeedId The FTSO feed ID to query.
     * @param _pythPriceId The corresponding Pyth Price ID for events and validation.
     */
    function refresh(
        PythStructs.Price storage _latestPrice,
        bytes21 _ftsoFeedId,
        bytes32 _pythPriceId
    ) internal {
        FtsoV2Interface ftsoV2 = ContractRegistry.getFtsoV2();
        (uint256 rawValue, int8 ftsoDecimals, uint64 ts) = ftsoV2.getFeedById(
            _ftsoFeedId
        );
        require(ts != 0, "FTSO_NO_DATA");

        // Directly modify the state of the calling contract
        _latestPrice.price = int64(uint64(rawValue));
        _latestPrice.conf = 0; // FTSO does not provide a confidence interval
        _latestPrice.expo = -ftsoDecimals;
        _latestPrice.publishTime = ts;

        emit Refreshed(
            _ftsoFeedId,
            _pythPriceId,
            _latestPrice.price,
            _latestPrice.expo,
            _latestPrice.publishTime
        );
    }

    /**
     * @notice Reads and validates the cached price data from the provided storage variable.
     */
    function getPriceNoOlderThan(
        PythStructs.Price storage _latestPrice,
        bytes32 _pythPriceId,
        bytes32 _id,
        uint _age
    ) internal view returns (PythStructs.Price memory) {
        require(_id == _pythPriceId, "INVALID_PRICE_ID");
        require(_latestPrice.publishTime != 0, "NO_DATA");
        require(
            block.timestamp - _latestPrice.publishTime <= _age,
            "STALE_PRICE"
        );
        return _latestPrice;
    }

    /**
     * @notice Reads the cached price data without a staleness check.
     */
    function getPriceUnsafe(
        PythStructs.Price storage _latestPrice,
        bytes32 _pythPriceId,
        bytes32 _id
    ) internal view returns (PythStructs.Price memory) {
        require(_id == _pythPriceId, "INVALID_PRICE_ID");
        require(_latestPrice.publishTime != 0, "NO_DATA");
        return _latestPrice;
    }
}
