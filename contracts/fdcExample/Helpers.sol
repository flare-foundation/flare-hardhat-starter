// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {console} from "hardhat/console.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IFdcHub} from "@flarenetwork/flare-periphery-contracts/coston2/IFdcHub.sol";
import {IFdcRequestFeeConfigurations} from
    "@flarenetwork/flare-periphery-contracts/coston2/IFdcRequestFeeConfigurations.sol";
import {IFlareSystemsManager} from "@flarenetwork/flare-periphery-contracts/coston2/IFlareSystemsManager.sol";
import {IRelay} from "@flarenetwork/flare-periphery-contracts/coston2/IRelay.sol";

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
