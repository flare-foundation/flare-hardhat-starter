// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6 <0.9;
pragma abicoder v2;

import {IAgentOwnerRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/IAgentOwnerRegistry.sol";
import {IAssetManager} from "@flarenetwork/flare-periphery-contracts/coston2/IAssetManager.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

/**
 * @title AgentInfo
 * @dev A contract to interact with IAgentOwnerRegistry and get agent information
 */
contract FassetsAgentInfo {
    function getAgentOwnerRegistry() internal view returns (IAgentOwnerRegistry) {
        IAssetManager assetManager = ContractRegistry.getAssetManagerFXRP();
        return IAgentOwnerRegistry(assetManager.getSettings().agentOwnerRegistry);
    }
    
    /**
     * @dev Get agent name by management address
     * @param _managementAddress The management address of the agent
     * @return The agent's name
     */
    function getAgentName(address _managementAddress) external view returns (string memory) {
        return getAgentOwnerRegistry().getAgentName(_managementAddress);
    }
    
    /**
     * @dev Get agent description by management address
     * @param _managementAddress The management address of the agent
     * @return The agent's description
     */
    function getAgentDescription(address _managementAddress) external view returns (string memory) {
        return getAgentOwnerRegistry().getAgentDescription(_managementAddress);
    }
    
    /**
     * @dev Get agent icon URL by management address
     * @param _managementAddress The management address of the agent
     * @return The agent's icon URL
     */
    function getAgentIconUrl(address _managementAddress) external view returns (string memory) {
        return getAgentOwnerRegistry().getAgentIconUrl(_managementAddress);
    }
}

