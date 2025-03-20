// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TestFtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IFeeCalculator} from "@flarenetwork/flare-periphery-contracts/coston2/IFeeCalculator.sol";

contract FastUpdatesConsumer {

    address public owner;
    bytes21[] public trackedFeeds;
    

    constructor(bytes21[] memory _feedIds) {
        owner = msg.sender;
        trackedFeeds = _feedIds;
    }

    function calculateRequiredFees() public view returns (uint256) {
        IFeeCalculator feeCalc = ContractRegistry.getFeeCalculator();
        return feeCalc.calculateFeeByIds(trackedFeeds);
    }

    function updatePrices() external payable {
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        
        // Get all prices using getFeedsByIdInWei
        (uint256[] memory prices, uint256 timestamp) = ftsoV2.getFeedsByIdInWei(trackedFeeds);

        // Get decimals for each feed individually since getFeedsByIdInWei doesn't return decimals
        for (uint256 i = 0; i < trackedFeeds.length; i++) {
            (, int8 decimals, ) = ftsoV2.getFeedById(trackedFeeds[i]);
        }

        // Refund excess fees if any
        if (msg.value > requiredFees) {
            payable(msg.sender).transfer(msg.value - requiredFees);
        }
    }

    function getTrackedFeeds() external view returns (bytes21[] memory) {
        return trackedFeeds;
    }
}
