/**
 * Usage:
 * yarn hardhat run scripts/fassets/autoRedeem.ts --network sepolia
 */

import { ethers } from "hardhat";
import { formatUnits, parseUnits, zeroPadValue, AbiCoder } from "ethers";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { EndpointId } from "@layerzerolabs/lz-definitions";

const CONFIG = {
    SEPOLIA_FXRP_OFT: process.env.SEPOLIA_FXRP_OFT || "0x81672c5d42F3573aD95A0bdfBE824faaC547d4E6",
    COSTON2_COMPOSER: process.env.COSTON2_COMPOSER || "",
    COSTON2_EID: EndpointId.FLARE_V2_TESTNET,
    EXECUTOR_GAS: 1_000_000,
    COMPOSE_GAS: 1_000_000,
    SEND_AMOUNT: "10",
    XRP_ADDRESS: "rpHuw4bKSjonKRrKKVYUZYYVedg1jyPrmp",
} as const;

type RedemptionParams = {
    amountLD: bigint;
    amountSD: bigint;
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

async function prepareRedemptionParams(oft: any, signerAddress: string): Promise<RedemptionParams> {
    const decimals = await oft.decimals();
    console.log(`\nℹ️  Source Token Decimals: ${decimals}`);

    const destDecimals = 6;

    const amountLD = parseUnits(CONFIG.SEND_AMOUNT, decimals);

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

function encodeComposeMessage(params: RedemptionParams): string {
    const abiCoder = AbiCoder.defaultAbiCoder();

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
        amountLD: params.amountLD,
        minAmountLD: params.amountLD,
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

    const params = await prepareRedemptionParams(oft, signer.address);

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
