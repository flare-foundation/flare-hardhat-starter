// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IAssetManager} from "@flarenetwork/flare-periphery-contracts/coston2/IAssetManager.sol";
import {RedemptionTicketInfo} from "@flarenetwork/flare-periphery-contracts/coston2/data/RedemptionTicketInfo.sol";

contract FAssetsRedemptionQueueReader {
    function getRedemptionQueue(
        uint256 _firstRedemptionTicketId,
        uint256 _pageSize
    )
        public
        view
        returns (
            RedemptionTicketInfo.Data[] memory _queue,
            uint256 _nextRedemptionTicketId
        )
    {
        IAssetManager assetManager = ContractRegistry.getAssetManagerFXRP();
        return
            assetManager.redemptionQueue(_firstRedemptionTicketId, _pageSize);
    }
}
