import { getFXRPAssetManager } from "../utils/fassets";
import { prepareAttestationRequestBase } from "../utils/fdc";
import { IAssetManagerInstance } from "../../typechain-types";
import { logEvents } from "../../scripts/utils/core";

// yarn hardhat run scripts/fassets/executeMinting.ts --network coston2

// Environment variables
const { COSTON2_DA_LAYER_URL, VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET } = process.env;

// Collateral reservation ID
const COLLATERAL_RESERVATION_ID = 10255417;

// FDC round id to get the proof for
const TARGET_ROUND_ID = 1053806;

// FDC request data
const attestationTypeBase = "Payment";
const sourceIdBase = "testXRP";
const verifierUrlBase = VERIFIER_URL_TESTNET;
const urlTypeBase = "xrp";

const transactionId = "EC0FC5F40FBE6AEAD31138898C71687B2902E462FD1BFEF3FB443BE5E2C018F9";
const inUtxo = "0";
const utxo = "0";

const AssetManager = artifacts.require("IAssetManager");

// Prepare FDC request
async function prepareFdcRequest(transactionId: string, inUtxo: string, utxo: string) {
    const requestBody = {
        transactionId: transactionId,
        inUtxo: inUtxo,
        utxo: utxo,
    };

    const url = `${verifierUrlBase}verifier/${urlTypeBase}/Payment/prepareRequest`;

    return await prepareAttestationRequestBase(
        url,
        VERIFIER_API_KEY_TESTNET,
        attestationTypeBase,
        sourceIdBase,
        requestBody
    );
}

// Get proof from FDC
async function getProof(roundId: number) {
    const request = await prepareFdcRequest(transactionId, inUtxo, utxo);
    const proofAndData = await fetch(`${COSTON2_DA_LAYER_URL}api/v0/fdc/get-proof-round-id-bytes`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-KEY": VERIFIER_API_KEY_TESTNET,
        },
        body: JSON.stringify({
            votingRoundId: roundId,
            requestBytes: request.abiEncodedRequest,
        }),
    });

    return await proofAndData.json();
}

async function parseEvents(receipt: any) {
    console.log("\nParsing events...", receipt.rawLogs);

    logEvents(receipt.rawLogs, "RedemptionTicketCreated", AssetManager.abi);

    logEvents(receipt.rawLogs, "MintingExecuted", AssetManager.abi);
}

async function main() {
    const proof = await getProof(TARGET_ROUND_ID);

    // FAssets FXRP asset manager on Songbird Testnet Coston2 network
    const assetManager: IAssetManagerInstance = await getFXRPAssetManager();

    // Execute minting
    const tx = await assetManager.executeMinting(
        {
            merkleProof: proof.proof,
            data: proof.response,
        },
        COLLATERAL_RESERVATION_ID
    );
    console.log("Transaction successful:", tx);

    // Parse execute minting log events
    await parseEvents(tx.receipt);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
