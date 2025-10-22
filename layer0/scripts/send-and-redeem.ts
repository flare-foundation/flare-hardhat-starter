/**
 * Example script to send FXRP from Sepolia to Coston2 with automatic redemption
 *
 * This demonstrates how to:
 * 1. Send OFT tokens from Sepolia (where FXRP is an OFT)
 * 2. Use LayerZero compose to trigger automatic redemption on Coston2
 * 3. Redeem the underlying asset (XRP) to a specified address
 *
 * Usage:
 * npx hardhat run src/scripts/send-and-redeem.ts --network sepolia
 */

import { Options } from "@layerzerolabs/lz-v2-utilities";
import { ethers } from "hardhat";

// Configuration - using existing deployed contracts
const CONFIG = {
    // Sepolia FXRP OFT address (already deployed)
    SEPOLIA_FXRP_OFT: process.env.SEPOLIA_FXRP_OFT || "0x81672c5d42F3573aD95A0bdfBE824FaaC547d4E6",

    // Coston2 configuration
    COSTON2_COMPOSER: process.env.COSTON2_COMPOSER || "", // Deploy FAssetRedeemComposer first
    COSTON2_FTESTXRP: process.env.COSTON2_FTESTXRP_TOKEN || "0x8b4abA9C4BD7DD961659b02129beE20c6286e17F",
    COSTON2_ASSET_MANAGER: process.env.COSTON2_FTESTXRP_ASSET_MANAGER || "0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA",

    // Coston2 EID (from hardhat.config.ts)
    COSTON2_EID: 40125, // EndpointId.FLARE_V2_TESTNET

    // Gas settings
    EXECUTOR_GAS: 200_000,
    COMPOSE_GAS: 300_000, // Extra gas for redemption
};

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);

    // Check composer is deployed
    if (!CONFIG.COSTON2_COMPOSER) {
        throw new Error("❌ COSTON2_COMPOSER not set in .env!\n   Deploy FAssetRedeemComposer first:\n   npx hardhat deploy --network coston2 --tags FAssetRedeemComposer");
    }

    // Parameters for the send
    const amountToSend = ethers.utils.parseUnits("10", 6); // 10 FXRP (6 decimals)
    const underlyingAddress = "rpHuw4bKSjonKRrKKVYUZYYVedg1jyPrmp"; // XRP address where you want to receive redeemed XRP
    const redeemer = signer.address; // Address that will receive any refunds/executor fees

    // Connect to the OFT contract on Sepolia
    const oft = await ethers.getContractAt("FAssetOFT", CONFIG.SEPOLIA_FXRP_OFT);

    // Encode the compose message with redemption details
    // Format: (amountToRedeem, underlyingAddress, redeemer)
    const composeMsg = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "string", "address"],
        [amountToSend, underlyingAddress, redeemer]
    );

    // Build LayerZero options with compose
    const options = Options.newOptions()
        .addExecutorLzReceiveOption(CONFIG.EXECUTOR_GAS, 0)
        .addExecutorComposeOption(0, CONFIG.COMPOSE_GAS, 0);

    // Build the send parameters
    const sendParam = {
        dstEid: CONFIG.COSTON2_EID,
        to: ethers.utils.zeroPad(CONFIG.COSTON2_COMPOSER, 32), // Send to composer
        amountLD: amountToSend,
        minAmountLD: amountToSend,
        extraOptions: options.toHex(),
        composeMsg: composeMsg,
        oftCmd: '0x',
    };

    // Quote the fee
    const { nativeFee, lzTokenFee } = await oft.quoteSend(sendParam, false);
    console.log("Native fee:", ethers.utils.formatEther(nativeFee), "ETH");

    // Check balance
    const balance = await oft.balanceOf(signer.address);
    console.log("Current FXRP balance:", ethers.utils.formatUnits(balance, 6));

    if (balance.lt(amountToSend)) {
        throw new Error("Insufficient FXRP balance");
    }

    // Send the transaction
    console.log("\nSending", ethers.utils.formatUnits(amountToSend, 6), "FXRP to Coston2 with auto-redeem...");
    console.log("Target composer:", CONFIG.COSTON2_COMPOSER);
    console.log("Underlying address:", underlyingAddress);

    const tx = await oft.send(
        sendParam,
        { nativeFee, lzTokenFee },
        signer.address,
        { value: nativeFee }
    );

    console.log("\nTransaction sent:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("Confirmed in block:", receipt.blockNumber);
    console.log("\nTrack your cross-chain transaction:");
    console.log(`https://testnet.layerzeroscan.com/tx/${tx.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
