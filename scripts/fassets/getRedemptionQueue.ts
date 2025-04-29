import { ethers } from "hardhat";

import { FAssetsRedemptionQueueReaderContract, FAssetsRedemptionQueueReaderInstance } from "../../typechain-types";

// AssetManager address on Songbird Testnet Coston network
const ASSET_MANAGER_ADDRESS = "0x56728e46908fB6FcC5BCD2cc0c0F9BB91C3e4D34";

async function main() {
    // Get the contract factory
    const FAssetsRedemptionQueueReader = (await ethers.getContractFactory(
        "FAssetsRedemptionQueueReader"
    )) as FAssetsRedemptionQueueReaderContract;

    // Deploy the contract
    const fAssetsRedemptionQueueReader = (await FAssetsRedemptionQueueReader.deploy(
        ASSET_MANAGER_ADDRESS
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
