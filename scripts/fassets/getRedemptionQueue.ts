// yarn hardhat run scripts/fassets/getRedemptionQueue.ts --network coston2

// Get the contract
const FAssetsRedemptionQueueReader = artifacts.require("FAssetsRedemptionQueueReader");

async function main() {
    // Deploy the contract
    const fAssetsRedemptionQueueReader = await FAssetsRedemptionQueueReader.new();
    console.log("FAssetsRedemptionQueueReader deployed to:", fAssetsRedemptionQueueReader.address);

    const redemptionQueue = await fAssetsRedemptionQueueReader.getRedemptionQueue(0, 20);
    console.log("Redemption queue:", redemptionQueue);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
