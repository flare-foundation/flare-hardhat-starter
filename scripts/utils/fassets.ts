import { getAssetManagerController } from "./getters";

// Flare Contracts Registry address https://dev.flare.network/network/guides/flare-contracts-registry#flare-contract-registry-address
const IAssetManager = artifacts.require("IAssetManager");

export async function getFXRPAssetManager() {
    try {
        // Get all asset managers
        const assetManagerController = await getAssetManagerController();
        const assetManagers = await assetManagerController.getAssetManagers();

        console.log("Found asset managers:", assetManagers);

        // Get the FxrpAssetManager address
        for (const assetManager of assetManagers) {
            const assetManagerContract = await IAssetManager.at(assetManager);
            const settings = await assetManagerContract.getSettings();

            console.log("Asset manager settings:", settings);

            if (settings.poolTokenSuffix === "TXRP") {
                console.log("Found FXRP AssetManager at:", assetManager);
                return assetManagerContract;
            }
        }
        
        throw new Error("FXRP AssetManager not found");
    } catch (error) {
        console.error("Error getting FXRP AssetManager:", error);
        throw error;
    }
}
