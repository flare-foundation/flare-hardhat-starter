/**
 * Usage:
 * yarn hardhat run scripts/fassets/deployFassetRedeemComposer.ts --network coston2
 */

import { artifacts, run } from "hardhat";
import { FAssetRedeemComposerInstance } from "../../typechain-types";

const LAYERZERO_ENDPOINT_V2 = "0x6EDCE65403992e310A62460808c4b910D972f10f"; // Coston2

const FAssetRedeemComposer = artifacts.require("FAssetRedeemComposer");

async function deployContract() {
    console.log("\n🚀 Deploying FAssetRedeemComposer...");

    // Notice: No Token Address needed anymore
    const fAssetRedeemComposer: FAssetRedeemComposerInstance = await FAssetRedeemComposer.new(LAYERZERO_ENDPOINT_V2);
    const contractAddress = fAssetRedeemComposer.address;

    console.log(`✅ Deployed at: ${contractAddress}`);
    return contractAddress;
}

async function verifyContract(contractAddress: string) {
    console.log("\n🔍 Verifying...");
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: [LAYERZERO_ENDPOINT_V2],
        });
    } catch (e: any) {
        console.log("Verification message:", e.message);
    }
}

async function main() {
    const address = await deployContract();
    await verifyContract(address);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
