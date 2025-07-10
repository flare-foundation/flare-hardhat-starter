import { deployAndLinkLibrary } from "../utils/library";

// yarn hardhat run scripts/fassets/getRedemptionQueue.ts --network coston2

// Get the contract
const FAssetsRedemptionQueueReader = artifacts.require("FAssetsRedemptionQueueReader");
const AssetManagerRegistryLibrary = artifacts.require("AssetManagerRegistryLibrary");

async function main() {
    // Deploy library and link to contract
    const { linkedContract: linkedFAssetsRedemptionQueueReader } = await deployAndLinkLibrary(
        FAssetsRedemptionQueueReader,
        AssetManagerRegistryLibrary
    );

    const fAssetsRedemptionQueueReader = await linkedFAssetsRedemptionQueueReader.new();
    console.log("FAssetsRedemptionQueueReader deployed to:", fAssetsRedemptionQueueReader.address);

    const redemptionQueue = await fAssetsRedemptionQueueReader.getRedemptionQueue(0, 20);
    console.log("Redemption queue:", redemptionQueue);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
