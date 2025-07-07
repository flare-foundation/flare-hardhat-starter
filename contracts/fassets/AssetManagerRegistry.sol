// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IFlareContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/IFlareContractRegistry.sol";

import {IAssetManager} from "@flarenetwork/flare-periphery-contracts/coston2/IAssetManager.sol";
import {IAssetManagerController} from "@flarenetwork/flare-periphery-contracts/coston2/IAssetManagerController.sol";

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

import {AssetManagerSettings} from "@flarenetwork/flare-periphery-contracts/coston2/data/AssetManagerSettings.sol";

contract AssetManagerRegistry {
    // TXRP_HASH is the hash of the string "TXRP"
    bytes32 private constant TXRP_HASH = keccak256(abi.encodePacked("TXRP"));

    function getFxrpAssetManager() public view returns (address) {
        // Use the ContractRegistry library to get the AssetManagerController
        IAssetManagerController assetManagerController = ContractRegistry
            .getAssetManagerController();

        // Get all the asset managers from the AssetManagerController
        IAssetManager[] memory assetManagers = assetManagerController
            .getAssetManagers();

        // Iterate over the asset managers
        for (uint256 i = 0; i < assetManagers.length; i++) {
            IAssetManager assetManager = IAssetManager(assetManagers[i]);

            // Get the settings of the asset manager
            AssetManagerSettings.Data memory settings = assetManager
                .getSettings();
            
            // Get the pool token suffix
            string memory poolTokenSuffix = settings.poolTokenSuffix;

            //return the address of the asset manager that has the pool token suffix "TXRP"
            if (
                keccak256(abi.encodePacked(poolTokenSuffix)) ==
                TXRP_HASH
            ) {
                return address(assetManager);
            }
        }
        // If no asset manager is found, return the zero address
        return address(0);
    }
}