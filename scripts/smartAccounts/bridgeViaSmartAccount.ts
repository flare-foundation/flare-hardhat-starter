/**
 * Usage:
 * yarn hardhat run scripts/smartAccounts/bridgeViaSmartAccount.ts --network coston2
 */

import { web3, artifacts } from "hardhat";
import { formatUnits } from "ethers";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { EndpointId } from "@layerzerolabs/lz-definitions";
import { Client, Wallet as XrplWallet, xrpToDrops } from "xrpl";
import { getAssetManagerFXRP } from "../utils/getters";
import { logEvents, sleep } from "../utils/core";
import { IAssetManagerInstance, IERC20Instance } from "../../typechain-types";
import * as fs from "fs";
import * as path from "path";

const IERC20 = artifacts.require("IERC20");

// ABIs
const MASTER_ACCOUNT_CONTROLLER_ABI = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../abi/MasterAccountController.json"), "utf-8")
).abi;

const FASSET_OFT_ADAPTER_ABI = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../abi/FAssetOFTAdapter.json"), "utf-8")
).abi;

// Configuration
const CONFIG = {
    // Contract Addresses (Coston2)
    MASTER_ACCOUNT_CONTROLLER: "0xa7bc2aC84DB618fde9fa4892D1166fFf75D36FA6",
    COSTON2_FTESTXRP: "0x8b4abA9C4BD7DD961659b02129beE20c6286e17F",
    COSTON2_OFT_ADAPTER: "0xCd3d2127935Ae82Af54Fc31cCD9D3440dbF46639",

    // XRPL Configuration
    XRPL_RPC: "wss://s.altnet.rippletest.net:51233",

    // Bridge Configuration (LayerZero)
    SEPOLIA_EID: EndpointId.SEPOLIA_V2_TESTNET,
    EXECUTOR_GAS: 400_000,
    BRIDGE_AMOUNT: "10", // Amount in FXRP

    // Minting Configuration
    AUTO_MINT_IF_NEEDED: true,
    MINT_LOTS: 1,
} as const;

type CustomInstruction = {
    targetContract: string;
    value: bigint;
    data: string;
};

async function getWallets() {
    const accounts = await web3.eth.getAccounts();
    const signerAddress = accounts[0];
    const xrplSecret = process.env.XRPL_SECRET;
    if (!xrplSecret) throw new Error("XRPL_SECRET not set in .env");
    const xrplWallet = XrplWallet.fromSeed(xrplSecret);

    console.log("Flare EOA:", signerAddress);
    console.log("XRPL Wallet:", xrplWallet.address);
    return { signerAddress, xrplWallet };
}

function getMasterController() {
    return new web3.eth.Contract(MASTER_ACCOUNT_CONTROLLER_ABI, CONFIG.MASTER_ACCOUNT_CONTROLLER);
}

/**
 * Step 1: Register the Bridge Instruction on Flare
 */
async function registerBridgeInstruction(recipientAddress: string, amountToBridge: bigint) {
    console.log("\n=== Step 1: Registering Bridge Instruction ===");
    const oftAdapter = new web3.eth.Contract(FASSET_OFT_ADAPTER_ABI, CONFIG.COSTON2_OFT_ADAPTER);

    // 1. Quote LayerZero Fee
    const options = Options.newOptions().addExecutorLzReceiveOption(CONFIG.EXECUTOR_GAS, 0);
    const sendParam = {
        dstEid: CONFIG.SEPOLIA_EID,
        to: web3.utils.padLeft(recipientAddress, 64),
        amountLD: amountToBridge.toString(),
        minAmountLD: amountToBridge.toString(),
        extraOptions: options.toHex(),
        composeMsg: "0x",
        oftCmd: "0x",
    };

    const quoteResult = await oftAdapter.methods.quoteSend(sendParam, false).call();
    const nativeFee = BigInt(quoteResult.nativeFee);
    console.log(`LayerZero Fee: ${formatUnits(nativeFee, 18)} CFLR`);

    // 2. Create Calldata for OFTAdapter
    const feeStruct = { nativeFee: nativeFee.toString(), lzTokenFee: "0" };
    const sendCallData = oftAdapter.methods.send(sendParam, feeStruct, recipientAddress).encodeABI();

    // 3. Register Instruction with Master Controller
    const customInstruction: CustomInstruction[] = [
        {
            targetContract: CONFIG.COSTON2_OFT_ADAPTER,
            value: nativeFee,
            data: sendCallData,
        },
    ];

    const masterController = getMasterController();
    const accounts = await web3.eth.getAccounts();

    console.log("Submitting registration tx...");
    const tx = await masterController.methods.registerCustomInstruction(customInstruction).send({ from: accounts[0] });

    // 4. Get the Call Hash (Encoded Instruction) from events
    const events = logEvents(tx.logs, "CustomInstructionRegistered", MASTER_ACCOUNT_CONTROLLER_ABI);
    if (!events || events.length === 0) throw new Error("Failed to register instruction");

    // Calculate the encoded hex that needs to go into the XRPL Memo
    const encodedInstructionBN = await masterController.methods.encodeCustomInstruction(customInstruction).call();
    const encodedInstruction = BigInt(encodedInstructionBN).toString(16).padStart(64, "0");

    console.log("✅ Instruction Registered.");
    console.log("Instruction Hash (Memo):", encodedInstruction);

    return encodedInstruction;
}

/**
 * Helper: Send XRPL Payment
 */
async function sendXrplMemoPayment(xrplWallet: any, destination: string, amountXrp: string, memoHex: string) {
    const client = new Client(CONFIG.XRPL_RPC);
    await client.connect();
    try {
        const payment = {
            TransactionType: "Payment",
            Account: xrplWallet.address,
            Destination: destination,
            Amount: xrpToDrops(amountXrp),
            Memos: [{ Memo: { MemoData: memoHex.toUpperCase() } }],
        };

        console.log(`Sending ${amountXrp} XRP to ${destination}...`);
        const prepared = await client.autofill(payment);
        const signed = xrplWallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        if (
            result.result.meta &&
            typeof result.result.meta === "object" &&
            result.result.meta.TransactionResult !== "tesSUCCESS"
        ) {
            throw new Error(`XRPL Payment Failed: ${result.result.meta.TransactionResult}`);
        }
        console.log(`Tx Hash: ${result.result.hash}`);
        return result.result.hash;
    } finally {
        await client.disconnect();
    }
}

/**
 * Get or Create Personal Account Balance
 */
async function checkPersonalAccount(xrplAddress: string, requiredAmount: bigint) {
    console.log("\n=== Checking Smart Account Balance ===");
    const masterController = getMasterController();
    const personalAccountAddr = await masterController.methods.getPersonalAccount(xrplAddress).call();
    const hasAccount = personalAccountAddr !== "0x0000000000000000000000000000000000000000";

    let balance = 0n;
    if (hasAccount) {
        const ftestxrp: IERC20Instance = await IERC20.at(CONFIG.COSTON2_FTESTXRP);
        balance = BigInt(await ftestxrp.balanceOf(personalAccountAddr));
        console.log(`Personal Account: ${personalAccountAddr}`);
        console.log(`Balance: ${formatUnits(balance, 6)} FXRP`);
    } else {
        console.log("Personal Account: Not created yet");
    }

    return {
        personalAccountAddr,
        hasAccount,
        needsDeposit: balance < requiredAmount,
    };
}

/**
 * Wait for CollateralReserved Event
 */
async function waitForReservationEvent(assetManager: IAssetManagerInstance, agentVault: string, startBlock: number) {
    console.log("⏳ Waiting for Operator to Execute Reservation on Flare...");
    const maxRetries = 5;
    for (let i = 0; i < maxRetries; i++) {
        const events = await assetManager.getPastEvents("CollateralReserved", {
            fromBlock: startBlock,
            toBlock: "latest",
            filter: { agentVault: agentVault },
        });

        if (events.length > 0) {
            const evt = events[events.length - 1];
            return {
                valueUBA: BigInt(evt.returnValues.valueUBA),
                paymentReference: evt.returnValues.paymentReference,
            };
        }
        await sleep(3000);
    }
    throw new Error("Timeout waiting for reservation event.");
}

/**
 * Perform Minting Flow
 */
async function mintFXRP(xrplWallet: any, lots: number) {
    console.log(`\n=== Starting Mint for ${lots} Lot(s) ===`);

    const assetManager = await getAssetManagerFXRP();
    const masterController = getMasterController();
    const operatorAddress = await masterController.methods.xrplProviderWallet().call();

    // 1. Find Agent
    const agents = await assetManager.getAvailableAgentsDetailedList(0, 20);
    const agent = agents._agents.find((a) => BigInt(a.freeCollateralLots) >= BigInt(lots));
    if (!agent) throw new Error("No agents available");
    console.log(`Selected Agent: ${agent.agentVault}`);

    const agentInfo = await assetManager.getAgentInfo(agent.agentVault);
    const agentXrplAddress = agentInfo.underlyingAddressString;

    // 2. Send Trigger (Instruction 05)
    // Format: 05 (Op) + AgentVault (20 bytes) + Lots (32 bytes)
    const agentVaultClean = agent.agentVault.toLowerCase().replace("0x", "");
    const lotsHex = BigInt(lots).toString(16).padStart(64, "0"); // Standard uint256 padding
    const instructionMemo = `05${agentVaultClean}${lotsHex}`;

    console.log("1. Sending Reservation Trigger...");
    const currentBlock = await web3.eth.getBlockNumber();
    await sendXrplMemoPayment(xrplWallet, operatorAddress, "1", instructionMemo);

    // 3. Wait for Event to get EXACT amounts
    const { valueUBA, paymentReference } = await waitForReservationEvent(assetManager, agent.agentVault, currentBlock);
    const xrpAmount = Number(valueUBA) / 1_000_000;

    console.log(`✅ Reservation Confirmed.`);
    console.log(`   Amount Required: ${xrpAmount} XRP`);
    console.log(`   Payment Ref: ${paymentReference}`);

    // 4. Send Collateral
    console.log("2. Sending Collateral to Agent...");
    // Strip 0x from payment reference for XRPL Memo
    const refClean = paymentReference.replace("0x", "");
    await sendXrplMemoPayment(xrplWallet, agentXrplAddress, xrpAmount.toString(), refClean);

    // 5. Wait for Execution
    // todo(Anthony): improve obtaining personal account
    console.log("⏳ Waiting for Smart Account Executor to mint FXRP...");
    const startBalance = (await checkPersonalAccount(xrplWallet.address, 0n)).hasAccount
        ? BigInt(
              await (
                  await IERC20.at(CONFIG.COSTON2_FTESTXRP)
              ).balanceOf(await masterController.methods.getPersonalAccount(xrplWallet.address).call())
          )
        : 0n;

    for (let i = 0; i < 40; i++) {
        const { needsDeposit } = await checkPersonalAccount(
            xrplWallet.address,
            BigInt(lots) * 10000000n + startBalance
        ); // Rough check
        if (!needsDeposit) {
            console.log("✅ Mint Complete!");
            return;
        }
        await sleep(5000);
    }
}

async function main() {
    const { signerAddress, xrplWallet } = await getWallets();
    const amountToBridge = BigInt(web3.utils.toWei(CONFIG.BRIDGE_AMOUNT, "mwei"));

    // 1. Check Balance / Mint
    const { needsDeposit } = await checkPersonalAccount(xrplWallet.address, amountToBridge);
    if (needsDeposit) {
        if (!CONFIG.AUTO_MINT_IF_NEEDED) throw new Error("Insufficient Funds");
        await mintFXRP(xrplWallet, CONFIG.MINT_LOTS);
    }

    // 2. Bridge
    console.log("\n=== Bridging to Sepolia ===");
    // Register the intent on EVM
    const encodedInstruction = await registerBridgeInstruction(signerAddress, amountToBridge);

    // Send the trigger on XRPL
    const masterController = getMasterController();
    const operatorAddress = await masterController.methods.xrplProviderWallet().call();

    console.log("Sending Bridge Trigger...");
    await sendXrplMemoPayment(xrplWallet, operatorAddress, "1", encodedInstruction);

    console.log("\n✅ Bridge Request Sent!");
    console.log("The Smart Account Executor will now verify the payment and execute the bridge.");
    console.log("Check LayerZero Scan for the message delivery.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
