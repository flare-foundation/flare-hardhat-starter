import { IAssetManagerInstance } from "../../typechain-types";
import { getFXRPAssetManagerAddress } from "./getFXRPAssetManagerAddress";

// yarn hardhat run scripts/fassets/settings.ts --network coston2

const IAssetManager = artifacts.require("IAssetManager");

async function main() {
    const assetManagerAddress = await getFXRPAssetManagerAddress();
    const assetManager = (await IAssetManager.at(assetManagerAddress)) as IAssetManagerInstance;
    const settings = await assetManager.getSettings();

    console.log(settings);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
