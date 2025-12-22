/**
 * Usage:
 * yarn hardhat run scripts/fassets/autoRedeemFromSepolia.ts --network sepolia
 */

import { ethers } from "hardhat";
import { formatUnits, zeroPadValue, AbiCoder } from "ethers";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { EndpointId } from "@layerzerolabs/lz-definitions";

const CONFIG = {
    SEPOLIA_FXRP_OFT: process.env.SEPOLIA_FXRP_OFT || "0x81672c5d42F3573aD95A0bdfBE824faaC547d4E6",
    COSTON2_COMPOSER: process.env.COSTON2_COMPOSER || "0x5051E8db650E9e0E2a3f03010Ee5c60e79CF583E",
    COSTON2_EID: EndpointId.FLARE_V2_TESTNET,
    EXECUTOR_GAS: 1_000_000,
    COMPOSE_GAS: 1_000_000,
    SEND_LOTS: "1",
    XRP_ADDRESS: "rpHuw4bKSjonKRrKKVYUZYYVedg1jyPrmp",
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

async function validateSetup() {
    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);

    if (!CONFIG.COSTON2_COMPOSER) {
        throw new Error("❌ COSTON2_COMPOSER not set in .env!");
    }
    return signer;
}

function calculateAmountToSend(lots: bigint) {
    // 1 lot = 10 FXRP (10_000_000 in 6 decimals)
    const lotSize = BigInt(10_000_000);
    return lotSize * lots;
}

async function connectToOFT() {
    return await ethers.getContractAt("FXRPOFT", CONFIG.SEPOLIA_FXRP_OFT);
}

function prepareRedemptionParams(signerAddress: string): RedemptionParams {
    const amountToSend = calculateAmountToSend(BigInt(CONFIG.SEND_LOTS));

    console.log("\n📋 Redemption Parameters:");
    console.log("   Amount:", formatUnits(amountToSend.toString(), 6), "FXRP");
    console.log("   XRP Address:", CONFIG.XRP_ADDRESS);
    console.log("   Redeemer:", signerAddress);

    return {
        amountToSend,
        underlyingAddress: CONFIG.XRP_ADDRESS,
        redeemer: signerAddress,
        signerAddress,
    };
}

function encodeComposeMessage(params: RedemptionParams): string {
    const abiCoder = AbiCoder.defaultAbiCoder();

    const composeMsg = abiCoder.encode(
        ["uint256", "string", "address"],
        [params.amountToSend, params.underlyingAddress, params.redeemer]
    );

    console.log("✓ Compose message encoded");
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
        amountLD: params.amountToSend,
        minAmountLD: params.amountToSend,
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
    console.log(`\n🚀 Sending ${formatUnits(params.amountToSend.toString(), 6)} FXRP to Coston2...`);

    const tx = await oft.send(sendParam, { nativeFee, lzTokenFee: 0 }, params.signerAddress, { value: nativeFee });

    console.log("✓ Tx Hash:", tx.hash);
    await tx.wait();
    console.log("✅ Transaction Confirmed.");
    console.log(`\nhttps://testnet.layerzeroscan.com/tx/${tx.hash}`);
}

async function main() {
    const signer = await validateSetup();
    const oft = await connectToOFT();

    const params = prepareRedemptionParams(signer.address);

    const composeMsg = encodeComposeMessage(params);

    const options = buildComposeOptions();
    const sendParam = buildSendParams(params, composeMsg, options);

    await checkBalance(oft, params.signerAddress, params.amountToSend);

    const { nativeFee } = await quoteFee(oft, sendParam);

    await executeSendAndRedeem(oft, sendParam, nativeFee, params);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
