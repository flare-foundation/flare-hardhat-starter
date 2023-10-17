// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import {IFtsoRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ftso/userInterfaces/IFtsoRegistry.sol";
import {IFtso} from "@flarenetwork/flare-periphery-contracts/coston2/ftso/userInterfaces/IFtso.sol";

import {FlareContractsRegistryLibrary} from "@flarenetwork/flare-periphery-contracts/coston2/util-contracts/ContractRegistryLibrary.sol";

contract PriceAnalytics {
    function getLast5Prices(
        string memory token
    )
        public
        view
        returns (uint256[] memory prices, uint256 mean, uint256 variance)
    {
        IFtsoRegistry ftsoRegistry = FlareContractsRegistryLibrary
            .getFtsoRegistry();

        IFtso ftso = ftsoRegistry.getFtsoBySymbol(token);

        (
            uint256 firstEpochStartTs,
            uint256 submitPeriodSeconds,
            uint256 revealPeriodSeconds
        ) = ftso.getPriceEpochConfiguration();

        uint256 epochNow = (block.timestamp - firstEpochStartTs) /
            submitPeriodSeconds;

        uint256 epoch = epochNow - 1;
        if (
            block.timestamp - epochNow * submitPeriodSeconds <
            revealPeriodSeconds
        ) {
            // We don't yet know the full price for epoch
            epoch -= 1;
        }
        uint256 num = 5;
        prices = new uint256[](num);
        for (uint256 i = 0; i < num; i++) {
            prices[i] = ftso.getEpochPrice(epoch - i);
        }

        uint256 sum = 0;
        for (uint256 i = 0; i < num; i++) {
            sum += prices[i];
        }
        // We incure some rounding error here, but it's not a big deal
        mean = sum / num;
        for (uint256 i = 0; i < num; i++) {
            if (prices[i] > mean) {
                variance += (prices[i] - mean) * (prices[i] - mean);
            } else {
                variance += (mean - prices[i]) * (mean - prices[i]);
            }
        }
        variance /= num;
    }
}
