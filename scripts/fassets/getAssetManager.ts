// yarn hardhat run scripts/fassets/getAssetManager.ts --network coston2

import { deployAndLinkLibrary } from "../utils/library";

const AssetManagerRegistry = artifacts.require("AssetManagerRegistry");
const AssetManagerRegistryLibrary = artifacts.require("AssetManagerRegistryLibrary");

async function main() {
    // Deploy library and link to contract
    const { linkedContract: linkedAssetManagerRegistry } = await deployAndLinkLibrary(
        AssetManagerRegistry,
        AssetManagerRegistryLibrary
    );

    // Deploy the contract with library linked
    const assetManagerRegistry = await linkedAssetManagerRegistry.new();
    console.log("AssetManagerRegistry deployed to:", assetManagerRegistry.address);

    const fxrpAssetManager = await assetManagerRegistry.getFxrpAssetManager();
    console.log("FXRP Asset Manager address:", fxrpAssetManager);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
