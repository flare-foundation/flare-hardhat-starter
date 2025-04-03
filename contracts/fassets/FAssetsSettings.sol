// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IAssetManager } from "flare-periphery-contracts-fassets-test/coston/IAssetManager.sol";

// Contract for accessing FAssets settings from the AssetManager
contract FAssetsSettings {
  // Connection to the main AssetManager contract
  IAssetManager public assetManager;

  constructor(address _assetManager) {
    assetManager = IAssetManager(_assetManager);
  }

  // This function gets two important numbers from the AssetManager:
  // lotSizeAMG: The smallest amount you can trade (in AMG units)
  // assetDecimals: How many decimal places the asset uses
  function getLotSize() public view returns(uint64 lotSizeAMG, uint8 assetDecimals) {
    lotSizeAMG = assetManager.getSettings().lotSizeAMG;
    assetDecimals = assetManager.getSettings().assetDecimals;
    
    return (lotSizeAMG, assetDecimals);
  }
}