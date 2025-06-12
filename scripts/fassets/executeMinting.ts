import { ethers } from "hardhat";

import { prepareAttestationRequestBase } from "../fdcExample/Base";
import { IAssetManagerInstance, IAssetManagerContract } from "../../typechain-types";

// yarn hardhat run scripts/fassets/executeMinting.ts --network coston2

// Environment variables
const { COSTON2_DA_LAYER_URL, VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET } = process.env;

// AssetManager address on Flare Testnet Coston2 network
const ASSET_MANAGER_ADDRESS = "0xDeD50DA9C3492Bee44560a4B35cFe0e778F41eC5";

// Collateral reservation ID
const COLLATERAL_RESERVATION_ID = 2680499;

// FDC round id to get the proof for
const TARGET_ROUND_ID = 1004741;

// FDC request data
const attestationTypeBase = "Payment";
const sourceIdBase = "testXRP";
const verifierUrlBase = VERIFIER_URL_TESTNET;
const urlTypeBase = "xrp";

const transactionId = "8643579D712C2596A5ACCDB0F450C85C86DE413D0BD040A7809C37B0E82A1D95";
const inUtxo = "0";
const utxo = "0";

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

    const assetManager = (await ethers.getContractAt("IAssetManager", ASSET_MANAGER_ADDRESS)) as IAssetManagerContract;

    for (const log of receipt.rawLogs) {
        try {
            const parsedLog = assetManager.interface.parseLog({
                topics: log.topics,
                data: log.data,
            });

            if (!parsedLog) continue;

            const collateralReservedEvents = ["RedemptionTicketCreated", "MintingExecuted"];
            if (!collateralReservedEvents.includes(parsedLog.name)) continue;

            console.log(`\nEvent: ${parsedLog.name}`);
            console.log("Arguments:", parsedLog.args);
        } catch (e) {
            console.log("Error parsing event:", e);
        }
    }
}

async function main() {
    const proof = await getProof(TARGET_ROUND_ID);

    // FAssets FXRP asset manager on Songbird Testnet Coston network
    const AssetManager = artifacts.require("IAssetManager");
    const assetManager: IAssetManagerInstance = await AssetManager.at(ASSET_MANAGER_ADDRESS);

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
