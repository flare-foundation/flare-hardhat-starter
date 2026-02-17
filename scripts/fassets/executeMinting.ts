import { web3 } from "hardhat";
import { getAssetManagerFXRP } from "../utils/getters";
import {
    prepareAttestationRequestBase,
    submitAttestationRequest,
    retrieveDataAndProofBaseWithRetry,
} from "../utils/fdc";
import { IAssetManagerInstance } from "../../typechain-types";
import { logEvents } from "../../scripts/utils/core";
import { collateralReservationId, xrpTransactionHash } from "./config/mintingConfig";

// yarn hardhat run scripts/fassets/executeMinting.ts --network coston2

// Environment variables
const { COSTON2_DA_LAYER_URL, VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET } = process.env;

// FDC request data
const attestationTypeBase = "Payment";
const sourceIdBase = "testXRP";
const verifierUrlBase = VERIFIER_URL_TESTNET;
const urlTypeBase = "xrp";

const AssetManager = artifacts.require("IAssetManager");

// Prepare FDC request
async function prepareFdcRequest(transactionId: string) {
    const requestBody = {
        transactionId: transactionId,
        inUtxo: "0",
        utxo: "0",
    };

    const url = `${verifierUrlBase}/verifier/${urlTypeBase}/Payment/prepareRequest`;

    return await prepareAttestationRequestBase(
        url,
        VERIFIER_API_KEY_TESTNET,
        attestationTypeBase,
        sourceIdBase,
        requestBody
    );
}

async function retrieveDataAndProof(abiEncodedRequest: string, roundId: number) {
    const url = `${COSTON2_DA_LAYER_URL}/api/v1/fdc/proof-by-request-round-raw`;
    console.log("Url:", url, "\n");
    return await retrieveDataAndProofBaseWithRetry(url, abiEncodedRequest, roundId);
}

function parseEvents(receipt: any) {
    console.log("\nParsing events...", receipt.rawLogs);
    logEvents(receipt.rawLogs, "RedemptionTicketCreated", AssetManager.abi);
    logEvents(receipt.rawLogs, "MintingExecuted", AssetManager.abi);
}

async function main() {
    if (!xrpTransactionHash) {
        throw new Error("No XRP transaction hash found in config. Run xrpPayment.ts first.");
    }

    console.log("Using collateral reservation ID:", collateralReservationId);
    console.log("Using XRP transaction hash:", xrpTransactionHash);

    // Prepare the attestation request
    const data = await prepareFdcRequest(xrpTransactionHash);
    console.log("Data:", data, "\n");

    const abiEncodedRequest = data.abiEncodedRequest;

    // Submit attestation request and get the round ID
    const roundId = await submitAttestationRequest(abiEncodedRequest);

    // Wait for proof
    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);

    // FAssets FXRP asset manager on Coston2
    const assetManager: IAssetManagerInstance = await getAssetManagerFXRP();

    // Decode the response_hex into the Payment.Response struct
    // The v1 DA layer API returns response_hex but not the decoded response
    const IPaymentVerification = await artifacts.require("IPaymentVerification");
    const responseType = IPaymentVerification._json.abi[0].inputs[0].components[1];
    const decodedResponse = web3.eth.abi.decodeParameter(responseType, proof.response_hex);
    console.log("Decoded response:", decodedResponse, "\n");

    // Execute minting
    const tx = await assetManager.executeMinting(
        {
            merkleProof: proof.proof,
            data: decodedResponse,
        },
        collateralReservationId
    );
    console.log("Minting executed successfully:", tx.tx);

    // Parse execute minting log events
    parseEvents(tx.receipt);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
