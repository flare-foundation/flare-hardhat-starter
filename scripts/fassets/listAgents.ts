import { IAssetManagerInstance } from "typechain-types";
import { getAssetManagerFXRP } from "../utils/getters";

/**
 * Script to list all available FAssets agents in chunks
 *
 * This script demonstrates how to iterate through all agents in the FAssets system
 * by fetching them in chunks to avoid overwhelming the RPC endpoint with large requests.
 *
 * Run with: yarn hardhat run scripts/fassets/listAgents.ts --network coston2
 */

// Print the agent info for each agent
async function printAgentInfo(assetManager: IAssetManagerInstance, agentVaultAddresses: string[]) {
    for (const agentVaultAddress of agentVaultAddresses) {
        const agentInfo = await assetManager.getAgentInfo(agentVaultAddress);
        console.log(agentInfo);
    }
}

async function main() {
    // Get the FAssets FXRP asset manager contract instance
    const assetManager: IAssetManagerInstance = await getAssetManagerFXRP();

    // Define how many agents to fetch per request
    // Using smaller chunks (e.g., 3) helps avoid RPC timeout issues
    const chunkSize = 3;

    // Fetch the first chunk and get the total count
    // The _totalLength property tells us how many agents exist in total
    console.log("Fetching first chunk with offset 0 and chunk size " + chunkSize);
    const firstChunk = await assetManager.getAvailableAgentsList(0, chunkSize);
    console.log(firstChunk._agents);
    await printAgentInfo(assetManager, firstChunk._agents);

    const totalLength = Number(BigInt(firstChunk._totalLength).toString());
    console.log(`Total number of agents: ${totalLength}`);

    // Iterate through remaining agents in chunks
    // The getAvailableAgentsDetailedList(start, end) function uses:
    // - start: inclusive start index (0-based)
    // - end: exclusive end index (like array slicing)
    // Example: (0, 3) returns agents at indices 0, 1, 2
    for (let offset = chunkSize; offset < totalLength; offset += chunkSize) {
        // Calculate end index, ensuring we don't exceed totalLength
        const endIndex = Math.min(offset + chunkSize, totalLength);
        console.log(`\n--- Fetching agents ${offset} to ${endIndex - 1} (end index ${endIndex} exclusive) ---`);

        // Fetch the chunk of agents
        const agents = await assetManager.getAvailableAgentsList(offset, endIndex);
        console.log(agents._agents);
        await printAgentInfo(assetManager, agents._agents);
    }

    console.log(`\nCompleted processing all ${totalLength} agents`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
