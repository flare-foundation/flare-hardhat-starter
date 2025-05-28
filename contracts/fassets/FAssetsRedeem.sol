// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IAssetManager} from "@flarenetwork/flare-periphery-contracts/coston2/IAssetManager.sol";
import {AssetManagerSettings} from "@flarenetwork/flare-periphery-contracts/coston2/userInterfaces/data/AssetManagerSettings.sol";

contract FAssetsRedeem {
    IAssetManager public immutable assetManager;

    constructor(address _assetManager) {
        assetManager = IAssetManager(_assetManager);
    }

    function redeem(
        uint256 _lots,
        string memory _redeemerUnderlyingAddressString
    ) public returns (uint256) {
        uint256 redeemedAmountUBA = assetManager.redeem(
            _lots,
            _redeemerUnderlyingAddressString,
            payable(address(0))
        );

        return redeemedAmountUBA;
    }

    function getSettings()
        public
        view
        returns (uint256 lotSizeAMG, uint256 assetDecimals)
    {
        AssetManagerSettings.Data memory settings = assetManager.getSettings();
        lotSizeAMG = settings.lotSizeAMG;
        assetDecimals = settings.assetDecimals;

        return (lotSizeAMG, assetDecimals);
    }
}
