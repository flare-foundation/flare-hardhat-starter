// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IAssetManager} from "@flarenetwork/flare-periphery-contracts/coston2/IAssetManager.sol";
import {RedemptionTicketInfo} from "@flarenetwork/flare-periphery-contracts/coston2/data/RedemptionTicketInfo.sol";

import {AssetManagerRegistryLibrary} from "./AssetManagerRegistryLibrary.sol";

contract FAssetsRedemptionQueueReader {
    IAssetManager public assetManager;

    constructor() {
        assetManager = IAssetManager(
            AssetManagerRegistryLibrary.getFxrpAssetManager()
        );
    }

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
        return
            assetManager.redemptionQueue(_firstRedemptionTicketId, _pageSize);
    }
}
