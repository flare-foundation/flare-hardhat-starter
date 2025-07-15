import { getAssetManagerController } from "./getters";

// yarn hardhat run scripts/fassets/getFXRPAssetManagerAddress.ts --network coston2

// Flare Contracts Registry address https://dev.flare.network/network/guides/flare-contracts-registry#flare-contract-registry-address
const IAssetManager = artifacts.require("IAssetManager");

export async function getFXRPAssetManagerAddress() {
    // Get all asset managers
    const assetManagerController = await await getAssetManagerController();
    const assetManagers = await assetManagerController.getAssetManagers();

    // Get the FxrpAssetManager address
    for (const assetManager of assetManagers) {
        const assetManagerContract = await IAssetManager.at(assetManager);
        const settings = await assetManagerContract.getSettings();

        if (settings.poolTokenSuffix === "TXRP") {
            return assetManager;
        }
    }
}
