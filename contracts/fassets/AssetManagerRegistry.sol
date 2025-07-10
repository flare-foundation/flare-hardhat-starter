// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {AssetManagerRegistryLibrary} from "./AssetManagerRegistryLibrary.sol";

contract AssetManagerRegistry {
    function getFxrpAssetManager() public view returns (address) {
        return AssetManagerRegistryLibrary.getFxrpAssetManager();
    }
}
