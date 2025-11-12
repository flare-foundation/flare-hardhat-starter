/**
 * Bridge FXRP from XRPL to Sepolia via Flare Smart Accounts
 *
 * This script provides a complete end-to-end flow:
 * 0. Check personal account balance and auto-mint if needed
 * 1. Mint FXRP via reserveCollateral instruction (if needed)
 * 2. Register custom instruction to bridge FXRP to Sepolia
 * 3. Send XRPL payment with encoded bridge instruction
 * 4. Monitor XRPL transaction confirmation
 * 5. Retrieve FDC attestation proof
 * 6. Submit proof to MasterAccountController
 * 7. Execute bridge to Sepolia via LayerZero
 *
 * Features:
 * - Automatically checks if you have sufficient FXRP balance
 * - If balance is insufficient, automatically mints FXRP via smart accounts
 * - Uses instruction ID 05 (reserveCollateral) to mint FXRP
 * - Single script handles both minting and bridging workflows
 *
 * Prerequisites:
 * - XRPL testnet account with sufficient XRP:
 *   - For 1 lot (10 FXRP): 1 XRP trigger + 10 XRP collateral + 1 XRP bridge = ~12 XRP
 * - XRPL_SECRET in .env
 * - C2FLR on Coston2 for gas
 *
 * Configuration:
 * - Set AUTO_MINT_IF_NEEDED to true/false in CONFIG
 * - Adjust MINT_LOTS for how much FXRP to mint (1 lot = 10 FXRP)
 * - Adjust BRIDGE_AMOUNT for the amount to bridge to Sepolia
 * - Agent vault is automatically fetched from AssetManager
 *
 * Usage:
 * yarn hardhat run scripts/smartAccounts/bridgeViaSmartAccount.ts --network coston2
 */

import { web3 } from "hardhat";
import { formatUnits } from "ethers";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { EndpointId } from "@layerzerolabs/lz-definitions";
import { Client, Wallet as XrplWallet, xrpToDrops, Payment } from "xrpl";
import BN from "bn.js";
import * as fs from "fs";
import * as path from "path";

import { getAssetManagerFXRP, getFlareSystemsManager } from "../utils/getters";
import { logEvents, sleep } from "../utils/core";
import { prepareAttestationRequestBase, retrieveDataAndProofBaseWithRetry } from "../utils/fdc";
import { IAssetManagerInstance, IERC20Instance } from "../../typechain-types";

// Truffle contract artifacts
const IERC20 = artifacts.require("IERC20");

// TODO:(Anthony) import from periphery once these contracts are included
const MASTER_ACCOUNT_CONTROLLER_ABI = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../abi/MasterAccountController.json"), "utf-8")
).abi;

const FASSET_OFT_ADAPTER_ABI = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../abi/FAssetOFTAdapter.json"), "utf-8")
).abi;

// Configuration
const CONFIG = {
    // Coston2 addresses
    MASTER_ACCOUNT_CONTROLLER: "0xa7bc2aC84DB618fde9fa4892D1166fFf75D36FA6",
    COSTON2_FTESTXRP: "0x8b4abA9C4BD7DD961659b02129beE20c6286e17F",
    COSTON2_OFT_ADAPTER: "0xCd3d2127935Ae82Af54Fc31cCD9D3440dbF46639",

    // FDC Configuration
    FDC_VERIFIER_API: process.env.FDC_VERIFIER_API as string,
    FDC_DA_API: process.env.FDC_DA_API as string,
    FDC_API_KEY: process.env.FDC_API_KEY as string,

    // XRPL Configuration
    XRPL_RPC: "wss://s.altnet.rippletest.net:51233",

    // LayerZero & Bridge Configuration
    SEPOLIA_EID: EndpointId.SEPOLIA_V2_TESTNET,
    EXECUTOR_GAS: 400_000,
    BRIDGE_AMOUNT: "10", // 10 FXRP = 1 lot

    // FAssets Minting Configuration
    AUTO_MINT_IF_NEEDED: true, // Automatically mint FXRP via FAssets if balance insufficient
    MINT_LOTS: 1, // Number of lots to mint (1 lot = 10 FXRP)
} as const;

type CustomInstruction = {
    targetContract: string;
    value: BN;
    data: string;
};

/**
 * Get accounts and XRPL wallet
 */
async function getWallets() {
    const accounts = await web3.eth.getAccounts();
    const signerAddress = accounts[0];

    const xrplSecret = process.env.XRPL_SECRET;
    if (!xrplSecret) {
        throw new Error("XRPL_SECRET not set in .env");
    }

    const xrplWallet = XrplWallet.fromSeed(xrplSecret);

    console.log("Flare Account:", signerAddress);
    console.log("XRPL Account:", xrplWallet.address);

    return { signerAddress, xrplWallet };
}

/**
 * Step 1: Register custom instruction with MasterAccountController
 */
async function registerCustomInstruction(recipientAddress: string, amountToBridge: BN) {
    console.log("\n=== Step 1: Registering Custom Instruction ===");

    // Build the send parameters for OFT Adapter
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

    // Get the OFT Adapter contract
    const oftAdapter = new web3.eth.Contract(FASSET_OFT_ADAPTER_ABI, CONFIG.COSTON2_OFT_ADAPTER);

    // Get the native fee for the bridge
    const quoteResult = await oftAdapter.methods.quoteSend(sendParam, false).call();
    const nativeFee = web3.utils.toBN(quoteResult.nativeFee);
    console.log("LayerZero Fee:", formatUnits(nativeFee.toString(), 18), "CFLR");

    // Encode the send call with fee
    const feeStruct = {
        nativeFee: nativeFee.toString(),
        lzTokenFee: "0",
    };

    const sendCallData = oftAdapter.methods.send(sendParam, feeStruct, recipientAddress).encodeABI();

    // Create custom instruction
    const customInstruction: CustomInstruction[] = [
        {
            targetContract: CONFIG.COSTON2_OFT_ADAPTER,
            value: nativeFee, // Must include LayerZero fee
            data: sendCallData,
        },
    ];

    // Register with MasterAccountController
    const masterController = new web3.eth.Contract(MASTER_ACCOUNT_CONTROLLER_ABI, CONFIG.MASTER_ACCOUNT_CONTROLLER);

    console.log("Registering custom instruction...");
    const accounts = await web3.eth.getAccounts();
    const tx = await masterController.methods.registerCustomInstruction(customInstruction).send({ from: accounts[0] });

    console.log("Transaction status:", tx.status);
    console.log("Transaction hash:", tx.transactionHash);

    // Parse logs to find CustomInstructionRegistered event
    const events = logEvents(tx.logs, "CustomInstructionRegistered", MASTER_ACCOUNT_CONTROLLER_ABI);

    if (!events || events.length === 0) {
        throw new Error("Failed to find CustomInstructionRegistered event");
    }

    const callHash = web3.utils.toBN(events[0].decoded.callHash);

    console.log("✅ Custom instruction registered!");
    console.log("Call Hash:", callHash.toString());

    return { callHash, nativeFee };
}

/**
 * Step 2: Encode instruction for XRPL memo
 */
function encodeInstruction(callHash: BN): string {
    const INSTRUCTION_ID_CUSTOM = 99; // 0x63

    // Convert callHash to 31 bytes (remove the highest byte)
    const callHashHex = callHash.toString(16).padStart(62, "0"); // 31 bytes = 62 hex chars
    const callHashBytes = callHashHex.slice(-62); // Take last 31 bytes

    // Instruction = ID (1 byte) + callHash (31 bytes)
    const instruction = INSTRUCTION_ID_CUSTOM.toString(16).padStart(2, "0") + callHashBytes;

    console.log("\n=== Step 2: Encoding Instruction ===");
    console.log("Instruction ID: 99 (Custom)");
    console.log("Encoded instruction:", "0x" + instruction);

    return instruction;
}

/**
 * Step 2.5: Get XRPL operator address from MasterAccountController
 */
async function getXrplOperatorAddress(): Promise<string> {
    const masterController = new web3.eth.Contract(MASTER_ACCOUNT_CONTROLLER_ABI, CONFIG.MASTER_ACCOUNT_CONTROLLER);

    console.log("\n=== Getting XRPL Operator Address ===");
    const operatorAddress = await masterController.methods.xrplProviderWallet().call();
    console.log("XRPL Operator Address:", operatorAddress);

    return operatorAddress;
}

/**
 * Step 3: Send XRPL payment with encoded instruction
 */
async function sendXrplPayment(
    xrplWallet: any,
    encodedInstruction: string,
    operatorAddress: string
): Promise<{ hash: string; timestamp: number }> {
    // Check balance first (need 1 XRP for this payment)
    await checkXrplBalance(xrplWallet, "1");

    console.log("\n=== Step 3: Sending XRPL Payment ===");

    const client = new Client(CONFIG.XRPL_RPC);
    await client.connect();

    try {
        const payment: Payment = {
            TransactionType: "Payment",
            Account: xrplWallet.address,
            Destination: operatorAddress,
            Amount: xrpToDrops(1), // 1 XRP payment
            Memos: [
                {
                    Memo: {
                        MemoData: encodedInstruction.toUpperCase(),
                    },
                },
            ],
        };

        console.log("Submitting XRPL payment...");
        console.log("From:", xrplWallet.address);
        console.log("To:", operatorAddress);
        console.log("Amount: 1 XRP");
        console.log("Memo:", encodedInstruction);

        const prepared = await client.autofill(payment);
        const signed = xrplWallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        if (result.result.meta && typeof result.result.meta === "object" && "TransactionResult" in result.result.meta) {
            const txResult = result.result.meta.TransactionResult;
            console.log("Transaction hash:", result.result.hash);
            console.log("Result:", txResult);

            // Check if transaction was successful
            if (txResult !== "tesSUCCESS") {
                throw new Error(
                    `XRPL payment failed with result: ${txResult}\n` +
                        `This usually means:\n` +
                        `- tecUNFUNDED_PAYMENT: Insufficient XRP balance in your XRPL account\n` +
                        `- Check your XRPL account balance and ensure you have enough XRP for the payment + fees`
                );
            }

            console.log("✅ XRPL payment successful!");
        }

        // Get timestamp from ledger
        const timestamp = Math.floor(Date.now() / 1000);

        return {
            hash: result.result.hash,
            timestamp,
        };
    } finally {
        await client.disconnect();
    }
}

/**
 * Step 4: Calculate voting round ID
 */
async function calculateVotingRoundId(timestamp: number): Promise<number> {
    const fsm = await getFlareSystemsManager();
    const firstTs = BigInt(await fsm.firstVotingRoundStartTs());
    const epoch = BigInt(await fsm.votingEpochDurationSeconds());
    const ts = BigInt(timestamp);
    const roundId = Number((ts - firstTs) / epoch);
    console.log("\n=== Step 4: Calculating Voting Round ===");
    console.log("Transaction timestamp:", timestamp);
    console.log("On-chain first round ts:", firstTs.toString());
    console.log("Epoch duration:", epoch.toString());
    console.log("Voting round ID:", roundId);
    return roundId;
}

/**
 * Step 6: Retrieve FDC attestation proof
 */
async function retrieveAttestationProof(votingRoundId: number, xrplTxHash: string): Promise<any> {
    console.log("\n=== Step 6: Retrieving FDC Attestation Proof ===");

    // Prepare request via Verifier using shared utils
    const verifierUrl = `${CONFIG.FDC_VERIFIER_API}/Payment/prepareRequest`;
    const apiKey = CONFIG.FDC_API_KEY || "";

    const requestBody = {
        transactionId: xrplTxHash.toUpperCase(),
        inUtxo: "0",
        utxo: "0",
    };

    console.log("Encoding attestation request...");
    console.log("Transaction ID:", requestBody.transactionId);
    console.log("Verifier URL:", verifierUrl);

    const { abiEncodedRequest } = await prepareAttestationRequestBase(
        verifierUrl,
        apiKey,
        "Payment",
        "testXRP",
        requestBody
    );

    console.log("Encoded request:", abiEncodedRequest);

    // Retrieve the proof via DA using shared utils (handles finalization wait internally)
    console.log("Retrieving proof from Data Availability...");
    const proofRaw = await retrieveDataAndProofBaseWithRetry(CONFIG.FDC_DA_API, abiEncodedRequest, votingRoundId);

    // Decode response into the struct expected by contracts
    const IPaymentVerification = await artifacts.require("IPaymentVerification");
    const responseType = IPaymentVerification._json.abi[0].inputs[0].components[1];
    const decodedResponse = web3.eth.abi.decodeParameter(responseType, proofRaw.response_hex);

    const proof = {
        merkleProof: proofRaw.proof,
        data: decodedResponse,
    };

    console.log("Structured proof for contract:");
    console.log("  merkleProof length:", proof.merkleProof.length);
    console.log("  data fields:", Object.keys(proof.data));
    return proof;
}

/**
 * Check if personal account exists and has sufficient FXRP balance
 */
async function checkPersonalAccountBalance(
    xrplAddress: string,
    requiredAmount: BN
): Promise<{ hasAccount: boolean; balance: BN; needsDeposit: boolean }> {
    console.log("\n=== Checking Personal Account ===");

    const masterController = new web3.eth.Contract(MASTER_ACCOUNT_CONTROLLER_ABI, CONFIG.MASTER_ACCOUNT_CONTROLLER);

    const personalAccount = await masterController.methods.getPersonalAccount(xrplAddress).call();
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const hasAccount = personalAccount !== ZERO_ADDRESS;

    console.log("Personal Account Address:", hasAccount ? personalAccount : "Not created yet");

    let balance = web3.utils.toBN(0);
    if (hasAccount) {
        const ftestxrp: IERC20Instance = await IERC20.at(CONFIG.COSTON2_FTESTXRP);
        balance = web3.utils.toBN(await ftestxrp.balanceOf(personalAccount));
        console.log("Current FXRP Balance:", formatUnits(balance.toString(), 6), "FXRP");
    } else {
        console.log("Current FXRP Balance: 0 FXRP (account not created)");
    }

    console.log("Required FXRP:", formatUnits(requiredAmount.toString(), 6), "FXRP");

    const needsDeposit = balance.lt(requiredAmount);
    if (needsDeposit) {
        const shortfall = requiredAmount.sub(balance);
        console.log("⚠️  Insufficient balance! Shortfall:", formatUnits(shortfall.toString(), 6), "FXRP");
    } else {
        console.log("✅ Sufficient balance available");
    }

    return { hasAccount, balance, needsDeposit };
}

/**
 * Check XRPL account balance
 */
async function checkXrplBalance(xrplWallet: any, requiredXRP: string): Promise<void> {
    console.log("\n=== Checking XRPL Account Balance ===");

    const client = new Client(CONFIG.XRPL_RPC);
    await client.connect();

    try {
        const response = await client.request({
            command: "account_info",
            account: xrplWallet.address,
            ledger_index: "validated",
        });

        const balance = Number(response.result.account_data.Balance) / 1_000_000; // Convert drops to XRP
        const required = Number(requiredXRP);

        console.log("XRPL Account:", xrplWallet.address);
        console.log("Current Balance:", balance.toFixed(6), "XRP");
        console.log("Required:", required, "XRP + fees");

        if (balance < required) {
            throw new Error(
                `Insufficient XRP balance!\n` +
                    `Current: ${balance.toFixed(6)} XRP\n` +
                    `Required: ${required} XRP + fees\n` +
                    `Please fund your XRPL testnet account at: https://faucet.altnet.rippletest.net/`
            );
        }

        console.log("✅ Sufficient XRP balance available");
    } finally {
        await client.disconnect();
    }
}

/**
 * Get FXRP AssetManager from Flare Contract Registry
 */
async function getFXRPAssetManager(): Promise<IAssetManagerInstance> {
    console.log("\n=== Getting FXRP AssetManager from Contract Registry ===");
    const assetManager = await getAssetManagerFXRP();
    console.log("✅ FXRP AssetManager Address:", assetManager.address);
    return assetManager;
}

/**
 * Get an available agent vault from AssetManager
 */
async function getAvailableAgentVault(assetManager: IAssetManagerInstance): Promise<string> {
    console.log("\n=== Fetching Available Agent Vault ===");
    console.log("AssetManager Address:", assetManager.address);

    // Query first 10 agents
    console.log("Querying available agents...");
    const result = await assetManager.getAvailableAgentsDetailedList(0, 10);
    const agents = result._agents;

    console.log(`Found ${agents.length} agent(s)`);

    // Find an agent with available lots
    for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const agentVault = agent.agentVault;
        const freeLots = web3.utils.toBN(agent.freeCollateralLots);

        console.log(`Agent ${agentVault}: ${freeLots.toString()} free lots`);

        if (freeLots.gtn(0)) {
            console.log(`✅ Selected agent vault: ${agentVault}`);
            return agentVault;
        }
    }

    throw new Error(
        "No agent vaults with available collateral found.\n" +
            "This might mean:\n" +
            "- All agents are at capacity\n" +
            "- No active agents in the system\n" +
            "Please try again later or contact support."
    );
}

/**
 * Get agent's XRPL underlying address from AssetManager
 */
async function getAgentUnderlyingAddress(assetManager: IAssetManagerInstance, agentVault: string): Promise<string> {
    console.log("\n=== Getting Agent's XRPL Address ===");

    // Get agent info which includes the underlying XRPL address
    const agentInfo = await assetManager.getAgentInfo(agentVault);
    const xrplAddress = agentInfo.underlyingAddressString;

    console.log("Agent's XRPL Address:", xrplAddress);

    return xrplAddress;
}

/**
 * Send XRPL payments for FAssets mint (2-step process)
 */
async function sendMintPayments(
    xrplWallet: any,
    operatorAddress: string,
    lots: number,
    agentVault: string,
    agentXrplAddress: string
): Promise<void> {
    // Calculate total XRP needed: 1 for trigger + (lots * 10) for collateral
    const collateralXRP = lots * 10;
    const totalXRP = 1 + collateralXRP;
    await checkXrplBalance(xrplWallet, totalXRP.toString());

    console.log("\n=== Step 1: Reserve Collateral (Instruction ID 05) ===");

    const client = new Client(CONFIG.XRPL_RPC);
    await client.connect();

    try {
        // STEP 1: Send reserveCollateral instruction
        // Format: 0x05 (1 byte) + agent vault (20 bytes) + lots (11 bytes)
        const agentVaultHex = agentVault.toLowerCase().replace("0x", "");
        const lotsBN = web3.utils.toBN(lots);
        const lotsHex = lotsBN.toString(16).padStart(22, "0");
        const mintInstruction = "05" + agentVaultHex + lotsHex;

        const payment1: Payment = {
            TransactionType: "Payment",
            Account: xrplWallet.address,
            Destination: operatorAddress,
            Amount: xrpToDrops(1), // Trigger payment
            Memos: [
                {
                    Memo: {
                        MemoData: mintInstruction.toUpperCase(),
                    },
                },
            ],
        };

        console.log("Sending reserve collateral instruction...");
        console.log("From:", xrplWallet.address);
        console.log("To:", operatorAddress);
        console.log("Amount: 1 XRP (trigger payment)");
        console.log("Memo:", mintInstruction);

        const prepared1 = await client.autofill(payment1);
        const signed1 = xrplWallet.sign(prepared1);
        const result1 = await client.submitAndWait(signed1.tx_blob);

        if (
            result1.result.meta &&
            typeof result1.result.meta === "object" &&
            "TransactionResult" in result1.result.meta
        ) {
            const txResult = result1.result.meta.TransactionResult;
            console.log("Transaction hash:", result1.result.hash);
            console.log("Result:", txResult);

            if (txResult !== "tesSUCCESS") {
                throw new Error(`Reserve collateral payment failed: ${txResult}`);
            }

            console.log("✅ Reserve collateral successful!");
        }

        // Wait a few seconds before sending second payment
        console.log("\nWaiting 5 seconds before sending collateral...");
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // STEP 2: Send actual XRP collateral to agent's XRPL address
        console.log("\n=== Step 2: Send XRP Collateral to Agent ===");

        const payment2: Payment = {
            TransactionType: "Payment",
            Account: xrplWallet.address,
            Destination: agentXrplAddress,
            Amount: xrpToDrops(collateralXRP), // Actual collateral
        };

        console.log("Sending XRP collateral...");
        console.log("From:", xrplWallet.address);
        console.log("To:", agentXrplAddress);
        console.log("Amount:", collateralXRP, "XRP (collateral for", lots, "lot(s))");

        const prepared2 = await client.autofill(payment2);
        const signed2 = xrplWallet.sign(prepared2);
        const result2 = await client.submitAndWait(signed2.tx_blob);

        if (
            result2.result.meta &&
            typeof result2.result.meta === "object" &&
            "TransactionResult" in result2.result.meta
        ) {
            const txResult = result2.result.meta.TransactionResult;
            console.log("Transaction hash:", result2.result.hash);
            console.log("Result:", txResult);

            if (txResult !== "tesSUCCESS") {
                throw new Error(`Collateral payment failed: ${txResult}`);
            }

            console.log("✅ Collateral payment successful!");
        }

        console.log("\n✅ Both mint payments sent successfully!");
        console.log("Executor will now process the mint...");
    } finally {
        await client.disconnect();
    }
}

/**
 * Wait for Smart Accounts executor to process the mint and update balance
 */
async function waitForMintExecution(xrplAddress: string, expectedMinimumBalance: BN): Promise<void> {
    console.log("\n=== Waiting for Smart Accounts Executor ===");
    console.log("The executor will automatically process your mint instruction.");
    console.log("This typically takes 3-10 minutes.");

    const masterController = new web3.eth.Contract(MASTER_ACCOUNT_CONTROLLER_ABI, CONFIG.MASTER_ACCOUNT_CONTROLLER);

    const maxAttempts = 20; // 20 attempts * 30 seconds = 10 minutes max
    const pollInterval = 30000; // 30 seconds

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`\nChecking balance (attempt ${attempt}/${maxAttempts})...`);

        const personalAccount = await masterController.methods.getPersonalAccount(xrplAddress).call();
        const hasAccount = personalAccount !== ZERO_ADDRESS;

        if (hasAccount) {
            const ftestxrp: IERC20Instance = await IERC20.at(CONFIG.COSTON2_FTESTXRP);
            const balance = web3.utils.toBN(await ftestxrp.balanceOf(personalAccount));

            console.log("Personal Account:", personalAccount);
            console.log("FXRP Balance:", formatUnits(balance.toString(), 6), "FXRP");

            if (balance.gte(expectedMinimumBalance)) {
                console.log("\n✅ Mint successful! Balance updated.");
                return;
            }
        } else {
            console.log("Personal account not created yet...");
        }

        if (attempt < maxAttempts) {
            console.log(`Waiting ${pollInterval / 1000} seconds before next check...`);
            await sleep(pollInterval);
        }
    }

    throw new Error(
        "Mint did not complete within the expected time.\n" + "The executor may be delayed. Check your balance later."
    );
}

/**
 * Step 7: Submit proof to MasterAccountController and execute
 */
async function executeWithProof(proof: any, xrplAddress: string): Promise<void> {
    console.log("\n=== Step 7: Executing Transaction on Flare ===");

    const masterController = new web3.eth.Contract(MASTER_ACCOUNT_CONTROLLER_ABI, CONFIG.MASTER_ACCOUNT_CONTROLLER);

    console.log("Submitting proof to MasterAccountController...");
    console.log("XRPL Address:", xrplAddress);

    const accounts = await web3.eth.getAccounts();
    const tx = await masterController.methods.executeTransaction(proof, xrplAddress).send({ from: accounts[0] });

    console.log("Transaction sent:", tx.transactionHash);
    console.log("✅ Transaction executed!");
    console.log("Block:", tx.blockNumber);

    // Parse InstructionExecuted event
    const events = logEvents(tx.logs, "InstructionExecuted", MASTER_ACCOUNT_CONTROLLER_ABI);

    if (events && events.length > 0) {
        console.log("\n✅ Instruction Executed!");
        console.log("- Personal Account:", events[0].decoded.personalAccount);
    }

    console.log("\n🎉 Success! Your transaction is now bridging to Sepolia via LayerZero!");
    console.log("\nTrack your cross-chain transaction:");
    console.log(`https://testnet.layerzeroscan.com/tx/${tx.transactionHash}`);
}

/**
 * Main execution flow
 */
async function main() {
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║   Bridge via Flare Smart Accounts: XRPL → Flare → Sepolia  ║");
    console.log("╚════════════════════════════════════════════════════════════╝");

    // Get wallets
    const { signerAddress, xrplWallet } = await getWallets();

    // Prepare bridge parameters
    const amountToBridge = web3.utils.toBN(web3.utils.toWei(CONFIG.BRIDGE_AMOUNT, "mwei")); // 6 decimals = mwei
    const recipientAddress = signerAddress;

    console.log("\n📋 Bridge Configuration:");
    console.log("Amount:", formatUnits(amountToBridge.toString(), 6), "FXRP");
    console.log("Destination: Sepolia");
    console.log("Recipient:", recipientAddress);

    console.log("\n💡 XRP Requirements:");
    const mintXrp = 1 + CONFIG.MINT_LOTS * 10; // 1 XRP trigger + (lots * 10 XRP collateral)
    console.log(
        "- If mint needed:",
        mintXrp,
        "XRP (1 trigger +",
        CONFIG.MINT_LOTS * 10,
        "collateral for",
        CONFIG.MINT_LOTS,
        "lot(s) =",
        CONFIG.MINT_LOTS * 10,
        "FXRP)"
    );
    console.log("- Bridge payment: 1 XRP (trigger fee)");
    console.log("- Total needed: ~" + (mintXrp + 1), "XRP + fees");
    console.log("- Fund your XRPL testnet account at: https://faucet.altnet.rippletest.net/");

    try {
        // Check if personal account has sufficient balance
        const { needsDeposit } = await checkPersonalAccountBalance(xrplWallet.address, amountToBridge);

        // If insufficient balance, mint FXRP via FAssets
        if (needsDeposit) {
            if (!CONFIG.AUTO_MINT_IF_NEEDED) {
                throw new Error(
                    `\n❌ Insufficient FXRP in your Smart Account!\n\n` +
                        `Set AUTO_MINT_IF_NEEDED=true in CONFIG to automatically mint FXRP.`
                );
            }

            console.log("\n╔════════════════════════════════════════════════════════════╗");
            console.log("║   Minting FXRP via Smart Account                           ║");
            console.log("╚════════════════════════════════════════════════════════════╝");
            console.log("Lots:", CONFIG.MINT_LOTS, "→", CONFIG.MINT_LOTS * 10, "FXRP");

            // Get FXRP AssetManager from contract registry
            const assetManager = await getFXRPAssetManager();

            // Get agent vault dynamically
            const agentVault = await getAvailableAgentVault(assetManager);
            console.log("Using Agent Vault:", agentVault);

            // Get agent's XRPL address
            const agentXrplAddress = await getAgentUnderlyingAddress(assetManager, agentVault);

            // Get XRPL operator address
            const operatorAddress = await getXrplOperatorAddress();

            // Send both XRPL payments for minting (reserve + collateral)
            await sendMintPayments(xrplWallet, operatorAddress, CONFIG.MINT_LOTS, agentVault, agentXrplAddress);

            // Wait for Smart Accounts executor to process the mint
            // The executor handles FDC attestation and execution automatically
            const expectedBalance = web3.utils.toBN(web3.utils.toWei((CONFIG.MINT_LOTS * 10).toString(), "mwei"));
            await waitForMintExecution(xrplWallet.address, expectedBalance);

            console.log("\n✅ Mint complete! Proceeding with bridge...\n");
        }

        console.log("\n╔════════════════════════════════════════════════════════════╗");
        console.log("║   Bridging FXRP to Sepolia                                 ║");
        console.log("╚════════════════════════════════════════════════════════════╝");

        // Step 1: Register custom instruction
        const { callHash } = await registerCustomInstruction(recipientAddress, amountToBridge);

        // Step 2: Encode instruction
        const encodedInstruction = encodeInstruction(callHash);

        // Step 2.5: Get XRPL operator address
        const operatorAddress = await getXrplOperatorAddress();

        // Step 3: Send XRPL payment
        const { hash: xrplTxHash, timestamp } = await sendXrplPayment(xrplWallet, encodedInstruction, operatorAddress);

        // Step 4: Calculate voting round
        const votingRoundId = await calculateVotingRoundId(timestamp);

        // Step 5: Retrieve proof
        const proof = await retrieveAttestationProof(votingRoundId, xrplTxHash);

        // Step 6: Execute on Flare
        await executeWithProof(proof, xrplWallet.address);

        console.log("\n✅ Complete! Bridge initiated via Smart Account.");
        console.log("Your FXRP will arrive on Sepolia in a few minutes.");
    } catch (error: any) {
        console.error("\n❌ Error:", error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
