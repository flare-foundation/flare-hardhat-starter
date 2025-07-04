import { ethers } from "hardhat";
import { getFXRPAssetManagerAddress } from "./getFXRPAssetManagerAddress";

import { FAssetsRedemptionQueueReaderContract, FAssetsRedemptionQueueReaderInstance } from "../../typechain-types";

// yarn hardhat run scripts/fassets/getRedemptionQueue.ts --network coston2

async function main() {
    // Get the contract factory
    const FAssetsRedemptionQueueReader = (await ethers.getContractFactory(
        "FAssetsRedemptionQueueReader"
    )) as FAssetsRedemptionQueueReaderContract;

    // Deploy the contract
    const fAssetsRedemptionQueueReader = (await FAssetsRedemptionQueueReader.deploy(
        await getFXRPAssetManagerAddress()
    )) as FAssetsRedemptionQueueReaderInstance;
    await fAssetsRedemptionQueueReader.waitForDeployment();
    const fAssetsRedemptionQueueReaderAddress = await fAssetsRedemptionQueueReader.getAddress();
    console.log("FAssetsRedemptionQueueReader deployed to:", fAssetsRedemptionQueueReaderAddress);

    const redemptionQueue = await fAssetsRedemptionQueueReader.getRedemptionQueue(0, 20);
    console.log("Redemption queue:", redemptionQueue);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
