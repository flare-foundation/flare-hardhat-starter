// yarn hardhat run scripts/fassets/getFXRPAssetManagerAddress.ts --network coston2

// Flare Contracts Registry address https://dev.flare.network/network/guides/flare-contracts-registry#flare-contract-registry-address
const FLARE_CONTRACTS_REGISTRY_ADDRESS = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

const IFlareContractRegistry = artifacts.require("IFlareContractRegistry");
const IAssetManagerController = artifacts.require("IAssetManagerController");
const IAssetManager = artifacts.require("IAssetManager");

export async function getFXRPAssetManagerAddress() {
    // Get the contracts registry
    const contractsRegistry = await IFlareContractRegistry.at(FLARE_CONTRACTS_REGISTRY_ADDRESS);

    // Get the AssetManagerController address
    const assetManagerControllerAddress = await contractsRegistry.getContractAddressByName("AssetManagerController");

    // Get all asset managers
    const assetManagerController = await IAssetManagerController.at(assetManagerControllerAddress);
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
