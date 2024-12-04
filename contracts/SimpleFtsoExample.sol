// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import {TestFtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IFtsoFeedIdConverter} from "@flarenetwork/flare-periphery-contracts/coston2/IFtsoFeedIdConverter.sol";

contract SimpleFtsoExample {
    /**
     * @dev Get the current price and decimals of an asset from FTSO system
     */
    function getCurrentTokenPriceWithDecimals(
        string memory feedName
    ) public view returns (uint256 _price, int8 _decimals) {
        // WARNING: This is a test contract, do not use it in production
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        // Convert feed name to feed ID
        bytes21 feedId = ContractRegistry.getFtsoFeedIdConverter().getFeedId(
            1, // Crypto feeds start with 1
            feedName
        );
        // Query the FTSO system
        //The call also returns `timestamp` when the price was last updated, but we discard it
        (_price, _decimals, ) = ftsoV2.getFeedById(feedId);
    }

    /**
     * @dev Get the current price of an asset from FTSO system. The returned price is converted to wei (18 decimal places of precission)
     */
    function getTokenPriceInUSDWei(
        string memory feedName
    ) public view returns (uint256 _priceInWei, uint256 _finalizedTimestamp) {
        // WARNING: This is a test contract, do not use it in production
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        // Query the FTSO system
        (_priceInWei, _finalizedTimestamp) = ftsoV2.getFeedByIdInWei(
            ContractRegistry.getFtsoFeedIdConverter().getFeedId(1, feedName)
        );
    }

    // Checks if token1/token2 price ratio is higher than numerator/denominator
    // Might overflow
    function isPriceRatioHigherThan(
        string memory token1,
        string memory token2,
        uint256 numerator,
        uint256 denominator
    ) public view returns (uint256 _price1, uint256 _price2, bool _is_higher) {
        // WARNING: This is a test contract, do not use it in production
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        IFtsoFeedIdConverter feedConverter = ContractRegistry
            .getFtsoFeedIdConverter();
        bytes21[] memory feedIds = new bytes21[](2);
        feedIds[0] = feedConverter.getFeedId(1, token1);
        feedIds[1] = feedConverter.getFeedId(1, token2);
        (uint256[] memory prices, ) = ftsoV2.getFeedsByIdInWei(feedIds);

        _price1 = prices[0];
        _price2 = prices[1];

        _is_higher = _price1 * denominator > _price2 * numerator;
    }
}
