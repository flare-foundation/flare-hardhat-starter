// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6 <0.9;
pragma abicoder v2;

import { IAgentOwnerRegistry } from "@flarenetwork/flare-periphery-contracts/coston2/IAgentOwnerRegistry.sol";
import { IAssetManager } from "@flarenetwork/flare-periphery-contracts/coston2/IAssetManager.sol";
import { ContractRegistry } from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

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
    // solhint-disable-next-line ordering
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

    /**
     * @dev Get agent terms of use URL by management address
     * @param _managementAddress The management address of the agent
     * @return The agent's terms of use URL
     */
    function getAgentTermsOfUseUrl(address _managementAddress) external view returns (string memory) {
        return getAgentOwnerRegistry().getAgentTermsOfUseUrl(_managementAddress);
    }

    /**
     * @dev Get agent details by management address
     * @param _managementAddress The management address of the agent
     * @return The agent's details (name, description, icon URL, terms of use URL)
     */
    function getAgentDetails(
        address _managementAddress
    ) external view returns (string memory, string memory, string memory, string memory) {
        IAssetManager assetManager = ContractRegistry.getAssetManagerFXRP();
        address agentOwnerRegistryAddress = assetManager.getSettings().agentOwnerRegistry;
        IAgentOwnerRegistry agentOwnerRegistry = IAgentOwnerRegistry(agentOwnerRegistryAddress);

        string memory name = agentOwnerRegistry.getAgentName(_managementAddress);
        string memory description = agentOwnerRegistry.getAgentDescription(_managementAddress);
        string memory iconUrl = agentOwnerRegistry.getAgentIconUrl(_managementAddress);
        string memory termsOfUseUrl = agentOwnerRegistry.getAgentTermsOfUseUrl(_managementAddress);

        return (name, description, iconUrl, termsOfUseUrl);
    }
}
