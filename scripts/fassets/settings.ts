import { IAssetManagerInstance } from "../../typechain-types";

const IAssetManager = artifacts.require("IAssetManager");
const ASSET_MANAGER_ADDRESS = "0x56728e46908fB6FcC5BCD2cc0c0F9BB91C3e4D34";

async function main() {
    const assetManager = (await IAssetManager.at(ASSET_MANAGER_ADDRESS)) as IAssetManagerInstance;
    const settings = await assetManager.getSettings();

    console.log(settings);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
