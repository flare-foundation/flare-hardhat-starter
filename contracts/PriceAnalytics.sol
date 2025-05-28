// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import {FtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

contract PriceAnalytics {
    function convertToWei(
        int256 price,
        int8 decimals
    ) public pure returns (int256) {
        int256 decimalsDiff = 18 - decimals;
        if (decimalsDiff < 0) {
            return price / int256(10 ** uint256(-decimalsDiff));
        } else {
            return price * int256(10 ** uint256(decimalsDiff));
        }
    }

    function provableCalculateVariance(
        FtsoV2Interface.FeedDataWithProof[] calldata priceFeeds
    )
        public
        view
        returns (int256[] memory prices, int256 mean, int256 variance)
    {
        FtsoV2Interface FTSOv2 = ContractRegistry.getFtsoV2();
        prices = new int256[](priceFeeds.length);

        // Check prices length
        require(prices.length > 1, "Need at least 2 prices");
        // Check correctness of prices
        for (uint256 i = 0; i < prices.length; i++) {
            require(
                FTSOv2.verifyFeedData(priceFeeds[i]),
                "Price feed data is not correct"
            );
            if (i > 0) {
                require(
                    priceFeeds[i].body.votingRoundId - 1 >
                        priceFeeds[i - 1].body.votingRoundId,
                    "Price feed data is not in sequential"
                );
            }
            prices[i] = convertToWei(
                int256(priceFeeds[i].body.value),
                priceFeeds[i].body.decimals
            );
        }

        int256 sum = 0;
        for (uint256 i = 0; i < prices.length; i++) {
            sum += prices[i];
        }
        // We incure some rounding error here, but it's not a big deal
        mean = sum / int256(prices.length);
        for (uint256 i = 0; i < prices.length; i++) {
            if (prices[i] > mean) {
                variance += (prices[i] - mean) * (prices[i] - mean);
            } else {
                variance += (mean - prices[i]) * (mean - prices[i]);
            }
        }
        variance /= int256(prices.length);
    }
}
