/**
 * Usage:
 * yarn hardhat run scripts/fassets/autoRedeem.ts --network sepolia
 */

import { ethers } from "hardhat";
import { formatUnits, parseUnits, zeroPadValue, AbiCoder } from "ethers";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { EndpointId } from "@layerzerolabs/lz-definitions";

// Configuration
const CONFIG = {
    SEPOLIA_FXRP_OFT: process.env.SEPOLIA_FXRP_OFT || "0x81672c5d42F3573aD95A0bdfBE824faaC547d4E6",
    COSTON2_COMPOSER: process.env.COSTON2_COMPOSER || "", // Address of FAssetRedeemComposer on Coston2
    COSTON2_EID: EndpointId.FLARE_V2_TESTNET,
    EXECUTOR_GAS: 1_000_000, // Increased gas for redemption logic
    COMPOSE_GAS: 1_000_000,
    SEND_AMOUNT: "10",
    XRP_ADDRESS: "rpHuw4bKSjonKRrKKVYUZYYVedg1jyPrmp",
} as const;

type RedemptionParams = {
    amountLD: bigint; // Local Decimals (Sepolia)
    amountSD: bigint; // Shared/Dest Decimals (Coston2 - 6)
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

async function validateSetup() {
    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);

    if (!CONFIG.COSTON2_COMPOSER) {
        throw new Error("❌ COSTON2_COMPOSER not set in .env!");
    }
    return signer;
}

async function connectToOFT() {
    return await ethers.getContractAt("FXRPOFT", CONFIG.SEPOLIA_FXRP_OFT);
}

/**
 * 1. Fetch Decimals and Calculate Amounts correctly
 */
async function prepareRedemptionParams(oft: any, signerAddress: string): Promise<RedemptionParams> {
    // Get Local Decimals (Sepolia)
    const decimals = await oft.decimals();
    console.log(`\nℹ️  Source Token Decimals: ${decimals}`);

    // Destination Decimals (Coston2 FAssets are always 6)
    const destDecimals = 6;

    // 1. Amount to Send (in Local Sepolia Decimals)
    // If decimals is 18, this makes 10000000000000000000
    const amountLD = parseUnits(CONFIG.SEND_AMOUNT, decimals);

    // 2. Amount for Compose Message (in Destination Coston2 Decimals)
    // This tells the composer exactly how much it *should* receive
    const amountSD = parseUnits(CONFIG.SEND_AMOUNT, destDecimals);

    console.log("\n📋 Redemption Parameters:");
    console.log(`   Send Amount (Source): ${formatUnits(amountLD, decimals)} FXRP (Raw: ${amountLD})`);
    console.log(`   Expect Amount (Dest): ${formatUnits(amountSD, destDecimals)} FXRP (Raw: ${amountSD})`);
    console.log("   XRP Address:", CONFIG.XRP_ADDRESS);

    return {
        amountLD,
        amountSD,
        underlyingAddress: CONFIG.XRP_ADDRESS,
        redeemer: signerAddress,
        signerAddress,
    };
}

/**
 * 2. Encode the Message using the DESTINATION amount (6 decimals)
 */
function encodeComposeMessage(params: RedemptionParams): string {
    const abiCoder = AbiCoder.defaultAbiCoder();

    // We encode amountSD (6 decimals) because that is what the contract on Coston2 expects
    const composeMsg = abiCoder.encode(
        ["uint256", "string", "address"],
        [params.amountSD, params.underlyingAddress, params.redeemer]
    );

    console.log("✓ Compose message encoded (using 6 decimals)");
    return composeMsg;
}

function buildComposeOptions(): string {
    const options = Options.newOptions()
        .addExecutorLzReceiveOption(CONFIG.EXECUTOR_GAS, 0)
        .addExecutorComposeOption(0, CONFIG.COMPOSE_GAS, 0);
    return options.toHex();
}

function buildSendParams(params: RedemptionParams, composeMsg: string, options: string): SendParams {
    return {
        dstEid: CONFIG.COSTON2_EID,
        to: zeroPadValue(CONFIG.COSTON2_COMPOSER, 32),
        amountLD: params.amountLD, // Send using Source Decimals
        minAmountLD: params.amountLD, // Slippage setting (using source decimals)
        extraOptions: options,
        composeMsg: composeMsg,
        oftCmd: "0x",
    };
}

async function checkBalance(oft: any, signerAddress: string, amountNeeded: bigint): Promise<void> {
    const balance = await oft.balanceOf(signerAddress);
    if (balance < amountNeeded) {
        throw new Error(`❌ Insufficient Balance. Have: ${balance}, Need: ${amountNeeded}`);
    }
    console.log("✓ Sufficient balance confirmed");
}

async function quoteFee(oft: any, sendParam: SendParams): Promise<{ nativeFee: bigint; lzTokenFee: bigint }> {
    const result = await oft.quoteSend(sendParam, false);
    console.log("\n💵 LayerZero Fee:", formatUnits(result.nativeFee, 18), "ETH");
    return { nativeFee: result.nativeFee, lzTokenFee: result.lzTokenFee };
}

async function executeSendAndRedeem(oft: any, sendParam: SendParams, nativeFee: bigint, params: RedemptionParams) {
    console.log(`\n🚀 Sending ${CONFIG.SEND_AMOUNT} FXRP to Coston2...`);

    const tx = await oft.send(sendParam, { nativeFee, lzTokenFee: 0 }, params.signerAddress, { value: nativeFee });

    console.log("✓ Tx Hash:", tx.hash);
    await tx.wait();
    console.log("✅ Transaction Confirmed.");
    console.log(`\nhttps://testnet.layerzeroscan.com/tx/${tx.hash}`);
}

async function main() {
    const signer = await validateSetup();
    const oft = await connectToOFT();

    // Prepare params dynamically fetching source decimals
    const params = await prepareRedemptionParams(oft, signer.address);

    // Encode the message for the destination (using params.amountSD)
    const composeMsg = encodeComposeMessage(params);

    const options = buildComposeOptions();
    const sendParam = buildSendParams(params, composeMsg, options);

    await checkBalance(oft, params.signerAddress, params.amountLD);

    const { nativeFee } = await quoteFee(oft, sendParam);

    await executeSendAndRedeem(oft, sendParam, nativeFee, params);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
