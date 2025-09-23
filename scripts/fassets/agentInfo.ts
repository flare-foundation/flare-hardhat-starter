import { IAssetManagerInstance } from "typechain-types";
import { getAssetManagerFXRP } from "../utils/getters";

// yarn hardhat run scripts/fassets/agentInfo.ts --network coston2

// Get the contract artifact
const FassetsAgentInfo = artifacts.require("FassetsAgentInfo");

async function main() {
    // Deploy the contract
    const fassetsAgentInfo = await FassetsAgentInfo.new();
    console.log("FassetsAgentInfo deployed to:", fassetsAgentInfo.address);

    // FAssets FXRP asset manager on Songbird Testnet Coston2 network
    const assetManager: IAssetManagerInstance = await getAssetManagerFXRP();
    const agents = await assetManager.getAvailableAgentsDetailedList(0, 100);
    // Get the first agent
    const agentAddress = agents._agents[0].ownerManagementAddress;

    // Call getSettings function
    const agentName = await fassetsAgentInfo.getAgentName(agentAddress); 
    console.log("Agent name:", agentName);

    const agentDescription = await fassetsAgentInfo.getAgentDescription(agentAddress);
    console.log("Agent description:", agentDescription);

    const agentIconUrl = await fassetsAgentInfo.getAgentIconUrl(agentAddress);
    console.log("Agent icon URL:", agentIconUrl);

    const agentTermsOfUseUrl = await fassetsAgentInfo.getAgentTermsOfUseUrl(agentAddress);
    console.log("Agent terms of use URL:", agentTermsOfUseUrl);

    console.log("--------------------------------");

    const agentDetails = await fassetsAgentInfo.getAgentDetails(agentAddress);
    console.log("Agent details:");
    console.log("Name:", agentDetails[0]);
    console.log("Description:", agentDetails[1]);
    console.log("Icon URL:", agentDetails[2]);
    console.log("Terms of use URL:", agentDetails[3]);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
