import { run } from "hardhat";

import { FAssetRedeemComposerInstance } from "../../typechain-types";

// yarn hardhat run scripts/fassets/deployFassetRedeemComposer.ts --network coston2

// Configuration
const FXRP_TOKEN_ADDRESS = "0x8b4abA9C4BD7DD961659b02129beE20c6286e17F";
const LAYERZERO_ENDPOINT_V2 = "0x6EDCE65403992e310A62460808c4b910D972f10f"; // Coston2 LayerZero EndpointV2

// Get the contract artifact
const FAssetRedeemComposer = artifacts.require("FAssetRedeemComposer");

/**
 * Deploys the FAssetRedeemComposer contract
 */
async function deployContract(): Promise<FAssetRedeemComposerInstance> {
    console.log("\n🚀 Deploying FAssetRedeemComposer...");
    console.log("Constructor arguments:");
    console.log("  - LayerZero Endpoint:", LAYERZERO_ENDPOINT_V2);
    console.log("  - FXRP Token:", FXRP_TOKEN_ADDRESS);

    const fAssetRedeemComposer: FAssetRedeemComposerInstance = await FAssetRedeemComposer.new(
        LAYERZERO_ENDPOINT_V2,
        FXRP_TOKEN_ADDRESS
    );

    const contractAddress = fAssetRedeemComposer.address;

    console.log(`✅ Deployed FAssetRedeemComposer at: ${contractAddress}`);

    return fAssetRedeemComposer;
}

/**
 * Verifies the deployed contract on block explorer
 */
async function verifyContract(contractAddress: string): Promise<void> {
    console.log("\n🔍 Verifying contract on block explorer...");

    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: [LAYERZERO_ENDPOINT_V2, FXRP_TOKEN_ADDRESS],
        });
        console.log("✅ Contract verified successfully");
    } catch (e: any) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("ℹ️  Contract is already verified");
        } else {
            console.error("⚠️  Verification failed:", e.message);
            console.log("\nYou can verify manually later with:");
            console.log(
                `npx hardhat verify --network coston2 ${contractAddress} ${LAYERZERO_ENDPOINT_V2} ${FXRP_TOKEN_ADDRESS}`
            );
        }
    }
}

/**
 * Main deployment function
 */
async function main() {
    console.log("Starting FAssetRedeemComposer deployment on Coston2...");

    const fAssetRedeemComposer = await deployContract();
    const contractAddress = fAssetRedeemComposer.address;

    await verifyContract(contractAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
