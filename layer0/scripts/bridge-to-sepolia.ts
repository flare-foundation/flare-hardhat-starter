/**
 * Bridge FXRP from Coston2 to Sepolia
 *
 * This script helps you get FXRP on Sepolia by bridging from Coston2
 *
 * Prerequisites:
 * - FTestXRP tokens on Coston2
 * - CFLR on Coston2 for gas
 *
 * Usage:
 * npx hardhat run src/scripts/bridge-to-sepolia.ts --network coston2
 */

import { Options } from "@layerzerolabs/lz-v2-utilities";
import { ethers } from "hardhat";

const CONFIG = {
    // Coston2 OFTAdapter for FTestXRP
    COSTON2_OFT_ADAPTER: process.env.COSTON2_OFT_ADAPTER || "0x0000000000000000000000000000000000000000",

    // Sepolia endpoint ID
    SEPOLIA_EID: 40161, // EndpointId.SEPOLIA_V2_TESTNET

    // Gas settings
    EXECUTOR_GAS: 200_000,
};

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);

    // Check if OFT Adapter is configured
    if (CONFIG.COSTON2_OFT_ADAPTER === "0x0000000000000000000000000000000000000000") {
        console.error("\n❌ Error: COSTON2_OFT_ADAPTER not configured!");
        console.log("\nYou need to deploy an OFTAdapter on Coston2 first.");
        console.log("Run: npx hardhat deploy --network coston2 --tags FAssetOFTAdapter");
        process.exit(1);
    }

    // Amount to bridge (20 FXRP = 20,000,000 base units, 6 decimals)
    // Note: This is the minimum lot size for redemption
    const amountToBridge = ethers.utils.parseUnits("20", 6);
    const recipientAddress = signer.address; // Send to yourself on Sepolia

    console.log("\n📋 Bridge Details:");
    console.log("From: Coston2");
    console.log("To: Sepolia");
    console.log("Amount:", ethers.utils.formatUnits(amountToBridge, 6), "FXRP");
    console.log("Recipient:", recipientAddress);

    // Connect to OFT Adapter
    const oftAdapter = await ethers.getContractAt("FAssetOFTAdapter", CONFIG.COSTON2_OFT_ADAPTER);

    // Get the underlying FTestXRP token
    const fTestXRPAddress = await oftAdapter.token();
    const fTestXRP = await ethers.getContractAt("IERC20", fTestXRPAddress);

    // Check balance
    const balance = await fTestXRP.balanceOf(signer.address);
    console.log("\nYour FTestXRP balance:", ethers.utils.formatUnits(balance, 6));

    if (balance.lt(amountToBridge)) {
        console.error("\n❌ Insufficient FTestXRP balance!");
        process.exit(1);
    }

    // Approve OFT Adapter to spend FTestXRP
    console.log("\n1️⃣ Approving FTestXRP...");
    const approveTx = await fTestXRP.approve(oftAdapter.address, amountToBridge);
    await approveTx.wait();
    console.log("✅ Approved");

    // Build LayerZero options
    const options = Options.newOptions()
        .addExecutorLzReceiveOption(CONFIG.EXECUTOR_GAS, 0);

    // Build send parameters
    const sendParam = {
        dstEid: CONFIG.SEPOLIA_EID,
        to: ethers.utils.zeroPad(recipientAddress, 32),
        amountLD: amountToBridge,
        minAmountLD: amountToBridge,
        extraOptions: options.toHex(),
        composeMsg: "0x",
        oftCmd: "0x",
    };

    // Quote the fee
    const { nativeFee } = await oftAdapter.quoteSend(sendParam, false);
    console.log("\n2️⃣ LayerZero Fee:", ethers.utils.formatEther(nativeFee), "CFLR");

    // Send the transaction
    console.log("\n3️⃣ Sending FXRP to Sepolia...");
    const tx = await oftAdapter.send(
        sendParam,
        { nativeFee, lzTokenFee: 0 },
        signer.address,
        { value: nativeFee }
    );

    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Confirmed in block:", receipt.blockNumber);

    console.log("\n🎉 Success! Your FXRP is on the way to Sepolia!");
    console.log("\nTrack your transaction:");
    console.log(`https://testnet.layerzeroscan.com/tx/${tx.hash}`);
    console.log("\nIt may take a few minutes to arrive on Sepolia.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
