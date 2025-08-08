import { IAssetManagerInstance } from "../../typechain-types";
import { getAssetManagerFXRP } from "../utils/getters";

// yarn hardhat run scripts/fassets/settings.ts --network coston2

const IAssetManager = artifacts.require("IAssetManager");

async function main() {
    const assetManager = await getAssetManagerFXRP();
    const settings = await assetManager.getSettings();

    console.log(settings);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
