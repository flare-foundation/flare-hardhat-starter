// yarn hardhat run scripts/fassets/getLotSize.ts --network coston2

async function main() {
    console.log("Deploying FAssetsSettings...");

    // Get the contract
    const FAssetsSettings = artifacts.require("FAssetsSettings");

    // Deploy the contract
    const fAssetsSettings = await FAssetsSettings.new();
    console.log("FAssetsSettings deployed to:", fAssetsSettings.address);

    // Call getSettings function
    const lotSize = await fAssetsSettings.getLotSize();
    console.log("Lot size:", lotSize[0]);
    console.log("Decimals:", lotSize[1]);

    // Convert lot size to XRP
    const lotSizeFXRP = Number(lotSize[0]) / Math.pow(10, Number(lotSize[1]));
    console.log("Lot size in XRP", lotSizeFXRP);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
