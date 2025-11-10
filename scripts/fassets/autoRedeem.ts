/**
 * Example script to send FXRP from Sepolia to Coston2 with automatic redemption
 *
 * This demonstrates how to:
 * 1. Send OFT tokens from Sepolia (where FXRP is an OFT)
 * 2. Use LayerZero compose to trigger automatic redemption on Coston2
 * 3. Redeem the underlying asset (XRP) to a specified address
 *
 * Usage:
 * yarn hardhat run scripts/fassets/autoRedeem.ts --network sepolia
 */

import { ethers } from "hardhat";
import { formatUnits, parseUnits, zeroPadValue, AbiCoder } from "ethers";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { EndpointId } from "@layerzerolabs/lz-definitions";

// Configuration - using existing deployed contracts
const CONFIG = {
    SEPOLIA_FXRP_OFT: process.env.SEPOLIA_FXRP_OFT || "0x81672c5d42F3573aD95A0bdfBE824FaaC547d4E6",
    COSTON2_COMPOSER: process.env.COSTON2_COMPOSER || "",
    COSTON2_EID: EndpointId.FLARE_V2_TESTNET,
    EXECUTOR_GAS: 200_000,
    COMPOSE_GAS: 300_000,
    SEND_AMOUNT: "10", // 10 FXRP
    XRP_ADDRESS: "rpHuw4bKSjonKRrKKVYUZYYVedg1jyPrmp", // Default XRP address we are auto-redeeming to
} as const;

type RedemptionParams = {
    amountToSend: bigint;
    underlyingAddress: string;
    redeemer: string;
    signerAddress: string;
};

type SendParams = {
    dstEid: EndpointId;
    to: string;
    amountLD: bigint;
    minAmountLD: bigint;
    extraOptions: string;
    composeMsg: string;
    oftCmd: string;
};

/**
 * Gets the signer and validates composer is deployed
 */
async function validateSetup() {
    const [signer] = await ethers.getSigners();

    console.log("Using account:", signer.address);

    if (!CONFIG.COSTON2_COMPOSER) {
        throw new Error(
            "❌ COSTON2_COMPOSER not set in .env!\n" +
                "   Deploy FAssetRedeemComposer first:\n" +
                "   npx hardhat deploy --network coston2 --tags FAssetRedeemComposer"
        );
    }

    console.log("✓ Composer configured:", CONFIG.COSTON2_COMPOSER);

    return signer;
}

/**
 * Prepares redemption parameters
 */
function prepareRedemptionParams(signerAddress: string): RedemptionParams {
    const amountToSend = parseUnits(CONFIG.SEND_AMOUNT, 6);
    const underlyingAddress = CONFIG.XRP_ADDRESS;
    const redeemer = signerAddress;

    console.log("\n📋 Redemption Parameters:");
    console.log("Amount:", formatUnits(amountToSend, 6), "FXRP");
    console.log("XRP Address:", underlyingAddress);
    console.log("Redeemer:", redeemer);

    return { amountToSend, underlyingAddress, redeemer, signerAddress };
}

/**
 * Connects to the OFT contract on Sepolia
 */
async function connectToOFT() {
    const oft = await ethers.getContractAt("FXRPOFT", CONFIG.SEPOLIA_FXRP_OFT);

    console.log("\n✓ Connected to FXRP OFT:", CONFIG.SEPOLIA_FXRP_OFT);

    return oft;
}

/**
 * Encodes the compose message with redemption details
 * Format: (amountToRedeem, underlyingAddress, redeemer)
 */
function encodeComposeMessage(params: RedemptionParams): string {
    const abiCoder = AbiCoder.defaultAbiCoder();
    const composeMsg = abiCoder.encode(
        ["uint256", "string", "address"],
        [params.amountToSend, params.underlyingAddress, params.redeemer]
    );

    console.log("Compose message encoded");

    return composeMsg;
}

/**
 * Builds LayerZero options with compose support
 */
function buildComposeOptions(): string {
    const options = Options.newOptions()
        .addExecutorLzReceiveOption(CONFIG.EXECUTOR_GAS, 0)
        .addExecutorComposeOption(0, CONFIG.COMPOSE_GAS, 0);

    return options.toHex();
}

/**
 * Builds the send parameters for LayerZero
 */
function buildSendParams(params: RedemptionParams, composeMsg: string, options: string): SendParams {
    return {
        dstEid: CONFIG.COSTON2_EID,
        to: zeroPadValue(CONFIG.COSTON2_COMPOSER, 32),
        amountLD: params.amountToSend,
        minAmountLD: params.amountToSend,
        extraOptions: options,
        composeMsg: composeMsg,
        oftCmd: "0x",
    };
}

/**
 * Checks if user has sufficient FXRP balance
 */
async function checkBalance(oft: any, signerAddress: string, amountToSend: bigint): Promise<void> {
    const balance = await oft.balanceOf(signerAddress);
    console.log("\n💰 Current FXRP balance:", formatUnits(balance, 6));

    if (balance < amountToSend) {
        console.error("\n❌ Insufficient FXRP balance!");
        console.log("   Required:", formatUnits(amountToSend, 6), "FXRP");
        console.log("   Available:", formatUnits(balance, 6), "FXRP");
        throw new Error("Insufficient FXRP balance");
    }

    console.log("Sufficient balance");
}

/**
 * Quotes the LayerZero fee for the send transaction
 */
async function quoteFee(oft: any, sendParam: SendParams): Promise<{ nativeFee: bigint; lzTokenFee: bigint }> {
    const result = await oft.quoteSend(sendParam, false);
    const nativeFee = result.nativeFee;
    const lzTokenFee = result.lzTokenFee;

    console.log("\n💵 LayerZero Fee:", formatUnits(nativeFee, 18), "ETH");

    return { nativeFee, lzTokenFee };
}

/**
 * Executes the send with auto-redeem
 */
async function executeSendAndRedeem(
    oft: any,
    sendParam: SendParams,
    nativeFee: bigint,
    lzTokenFee: bigint,
    params: RedemptionParams
): Promise<void> {
    console.log("\n🚀 Sending", formatUnits(params.amountToSend, 6), "FXRP to Coston2 with auto-redeem...");
    console.log("Target composer:", CONFIG.COSTON2_COMPOSER);
    console.log("Underlying address:", params.underlyingAddress);

    const tx = await oft.send(sendParam, { nativeFee, lzTokenFee }, params.signerAddress, { value: nativeFee });

    console.log("\n✓ Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Confirmed in block:", receipt?.blockNumber);

    console.log("\n🎉 Success! Your FXRP is on the way to Coston2!");
    console.log("\n📊 Track your cross-chain transaction:");
    console.log(`https://testnet.layerzeroscan.com/tx/${tx.hash}`);
    console.log("\n⏳ The auto-redeem will execute once the message arrives on Coston2.");
    console.log("XRP will be sent to:", params.underlyingAddress);
}

async function main() {
    // 1. Validate setup and get signer
    const signer = await validateSetup();

    // 2. Prepare redemption parameters
    const params = prepareRedemptionParams(signer.address);

    // 3. Connect to OFT contract
    const oft = await connectToOFT();

    // 4. Encode compose message
    const composeMsg = encodeComposeMessage(params);

    // 5. Build LayerZero options
    const options = buildComposeOptions();

    // 6. Build send parameters
    const sendParam = buildSendParams(params, composeMsg, options);

    // 7. Check balance
    await checkBalance(oft, params.signerAddress, params.amountToSend);

    // 8. Quote fee
    const { nativeFee, lzTokenFee } = await quoteFee(oft, sendParam);

    // 9. Execute send with auto-redeem
    await executeSendAndRedeem(oft, sendParam, nativeFee, lzTokenFee, params);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
