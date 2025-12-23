/**
 * Usage:
 * yarn hardhat run scripts/fassets/autoRedeemFromSepolia.ts --network sepolia
 */

import { web3 } from "hardhat";
import { formatUnits } from "ethers";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { EndpointId } from "@layerzerolabs/lz-definitions";
import { FXRPOFTInstance } from "../../typechain-types";

const FXRPOFT = artifacts.require("FXRPOFT");

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
    amountLD: string;
    minAmountLD: string;
    extraOptions: string;
    composeMsg: string;
    oftCmd: string;
};

async function validateSetup() {
    const accounts = await web3.eth.getAccounts();
    const signerAddress = accounts[0];
    console.log("Using account:", signerAddress);

    if (!CONFIG.COSTON2_COMPOSER) {
        throw new Error("COSTON2_COMPOSER not set in .env!");
    }
    return signerAddress;
}

function calculateAmountToSend(lots: bigint) {
    // 1 lot = 10 FXRP (10_000_000 in 6 decimals)
    const lotSize = BigInt(10_000_000);
    return lotSize * lots;
}

async function connectToOFT(): Promise<FXRPOFTInstance> {
    return await FXRPOFT.at(CONFIG.SEPOLIA_FXRP_OFT);
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
    const composeMsg = web3.eth.abi.encodeParameters(
        ["uint256", "string", "address"],
        [params.amountToSend.toString(), params.underlyingAddress, params.redeemer]
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
        to: web3.utils.padLeft(CONFIG.COSTON2_COMPOSER, 64),
        amountLD: params.amountToSend.toString(),
        minAmountLD: params.amountToSend.toString(),
        extraOptions: options,
        composeMsg: composeMsg,
        oftCmd: "0x",
    };
}

async function checkBalance(oft: FXRPOFTInstance, signerAddress: string, amountNeeded: bigint): Promise<void> {
    const balance = await oft.balanceOf(signerAddress);
    if (BigInt(balance.toString()) < amountNeeded) {
        throw new Error(`Insufficient Balance. Have: ${balance.toString()}, Need: ${amountNeeded}`);
    }
    console.log("✓ Sufficient balance confirmed");
}

async function quoteFee(oft: FXRPOFTInstance, sendParam: SendParams) {
    const result = await oft.quoteSend(sendParam, false);
    const nativeFee = BigInt(result.nativeFee.toString());
    console.log("\n💵 LayerZero Fee:", formatUnits(nativeFee.toString(), 18), "ETH");
    return nativeFee;
}

async function executeSendAndRedeem(
    oft: FXRPOFTInstance,
    sendParam: SendParams,
    nativeFee: bigint,
    params: RedemptionParams
) {
    console.log(`\n🚀 Sending ${formatUnits(params.amountToSend.toString(), 6)} FXRP to Coston2...`);

    const tx = await oft.send(sendParam, { nativeFee: nativeFee.toString(), lzTokenFee: "0" }, params.signerAddress, {
        value: nativeFee.toString(),
    });

    console.log("✓ Tx Hash:", tx.tx);
    console.log("✅ Confirmed in block:", tx.receipt.blockNumber);
    console.log(`\nhttps://testnet.layerzeroscan.com/tx/${tx.tx}`);
}

async function main() {
    const signerAddress = await validateSetup();
    const oft = await connectToOFT();

    const params = prepareRedemptionParams(signerAddress);

    const composeMsg = encodeComposeMessage(params);

    const options = buildComposeOptions();
    const sendParam = buildSendParams(params, composeMsg, options);

    await checkBalance(oft, params.signerAddress, params.amountToSend);

    const nativeFee = await quoteFee(oft, sendParam);

    await executeSendAndRedeem(oft, sendParam, nativeFee, params);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
