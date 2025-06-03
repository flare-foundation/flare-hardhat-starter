import { IAssetManagerInstance } from "../../typechain-types";

// yarn hardhat run scripts/fassets/settings.ts --network coston2

const IAssetManager = artifacts.require("IAssetManager");

// AssetManager address on Flare Testnet Coston2 network
const ASSET_MANAGER_ADDRESS = "0xDeD50DA9C3492Bee44560a4B35cFe0e778F41eC5";

async function main() {
    const assetManager = (await IAssetManager.at(ASSET_MANAGER_ADDRESS)) as IAssetManagerInstance;
    const settings = await assetManager.getSettings();

    console.log(settings);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
