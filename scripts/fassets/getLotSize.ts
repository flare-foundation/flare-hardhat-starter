// yarn hardhat run scripts/fassets/getLotSize.ts --network coston2

import { deployAndLinkLibrary } from "../../utils/library";

// Get the contract
const FAssetsSettings = artifacts.require("FAssetsSettings");
const AssetManagerRegistryLibrary = artifacts.require("AssetManagerRegistryLibrary");

async function main() {
    // Deploy library and link to contract
    const { linkedContract: linkedFAssetsSettings } = await deployAndLinkLibrary(
        FAssetsSettings,
        AssetManagerRegistryLibrary
    );

    // Deploy the contract with library linked
    const fAssetsSettings = await linkedFAssetsSettings.new();
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
