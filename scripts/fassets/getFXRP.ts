import { getFXRPAssetManagerAddress } from "../utils/fassets";

// yarn hardhat run scripts/fassets/getFXRP.ts --network coston2

const IAssetManager = artifacts.require("IAssetManager");

async function main() {
    const assetManager = await IAssetManager.at(await getFXRPAssetManagerAddress());
    const fasset = await assetManager.fAsset();

    console.log("FXRP address", fasset);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
