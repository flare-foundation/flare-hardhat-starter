// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {console} from "hardhat/console.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston/ContractRegistry.sol";
import {IFdcHub} from "@flarenetwork/flare-periphery-contracts/coston/IFdcHub.sol";
import {IFdcRequestFeeConfigurations} from
    "@flarenetwork/flare-periphery-contracts/coston/IFdcRequestFeeConfigurations.sol";
import {IFlareSystemsManager} from "@flarenetwork/flare-periphery-contracts/coston/IFlareSystemsManager.sol";
import {IRelay} from "@flarenetwork/flare-periphery-contracts/coston/IRelay.sol";

contract Helpers {
    function getFdcHub() public view returns (IFdcHub) {
        return ContractRegistry.getFdcHub();
    }

    function getFdcRequestFeeConfigurations() public view returns (IFdcRequestFeeConfigurations) {
        return ContractRegistry.getFdcRequestFeeConfigurations();
    }

    function getFlareSystemsManager() public view returns (IFlareSystemsManager) {
        return ContractRegistry.getFlareSystemsManager();
    }

    function getRelay() public view returns (IRelay) {
        return ContractRegistry.getRelay();
    }
}
