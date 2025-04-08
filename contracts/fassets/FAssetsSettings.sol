// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// Import the AssetManager interface
import {IAssetManager} from "@flarenetwork/flare-periphery-contracts/coston/IAssetManager.sol";

// Contract for accessing FAssets settings from the asset manager
contract FAssetsSettings {
    // Connection to the AssetManager contract
    IAssetManager public assetManager;

    // Constructor initializes the contract with the AssetManager contract address
    constructor(address _assetManager) {
        assetManager = IAssetManager(_assetManager);
    }

    // This function gets two important numbers from the asset manager settings:
    // * lotSizeAMG: The smallest amount you can trade (in AMG units)
    // * assetDecimals: How many decimal places the asset uses
    // FAssets Operation Parameters https://dev.flare.network/fassets/operational-parameters
    function getLotSize() public view returns (uint64 lotSizeAMG, uint8 assetDecimals) {
        lotSizeAMG = assetManager.getSettings().lotSizeAMG;
        assetDecimals = assetManager.getSettings().assetDecimals;

        return (lotSizeAMG, assetDecimals);
    }
}
