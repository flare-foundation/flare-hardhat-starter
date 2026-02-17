// import { AddressRegistryInstance } from "../../typechain-types";
import {
    prepareAttestationRequestBase,
    submitAttestationRequest,
    retrieveDataAndProofBaseWithRetry,
} from "../utils/fdc";

const { VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

// yarn hardhat run scripts/fdcExample/ConfirmedBlockHeightExists.ts --network coston2

// Request data - fetched dynamically to avoid stale block numbers
const queryWindow = "1"; // in seconds

// Configuration constants
const attestationTypeBase = "ConfirmedBlockHeightExists";
const sourceIdBase = "testXRP";
const verifierUrlBase = VERIFIER_URL_TESTNET;
const urlTypeBase = "xrp";

async function prepareAttestationRequest(blockNumber: string, queryWindow: string) {
    const requestBody = {
        blockNumber: blockNumber,
        queryWindow: queryWindow,
    };

    const url = `${verifierUrlBase}/verifier/${urlTypeBase}/ConfirmedBlockHeightExists/prepareRequest`;
    const apiKey = VERIFIER_API_KEY_TESTNET ?? "";

    return await prepareAttestationRequestBase(url, apiKey, attestationTypeBase, sourceIdBase, requestBody);
}

async function retrieveDataAndProof(abiEncodedRequest: string, roundId: number) {
    const url = `${COSTON2_DA_LAYER_URL}/api/v1/fdc/proof-by-request-round-raw`;
    console.log("Url:", url, "\n");
    return await retrieveDataAndProofBaseWithRetry(url, abiEncodedRequest, roundId);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function deployAndVerifyContract() {}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function interactWithContract() {}

async function getRecentXrpLedgerIndex(): Promise<string> {
    const response = await fetch("https://s.altnet.rippletest.net:51234/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "ledger", params: [{ ledger_index: "validated" }] }),
    });
    const json = await response.json();
    // Use a block ~10 behind the latest to ensure it's well confirmed
    const ledgerIndex = json.result.ledger_index - 10;
    console.log("Using XRP ledger index:", ledgerIndex, "\n");
    return ledgerIndex.toString();
}

async function main() {
    const blockNumber = await getRecentXrpLedgerIndex();
    const data = await prepareAttestationRequest(blockNumber, queryWindow);
    console.log("Data:", data, "\n");

    const abiEncodedRequest = data.abiEncodedRequest;
    const roundId = await submitAttestationRequest(abiEncodedRequest);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);

    // const addressRegistry: AddressRegistryInstance =
    //   await deployAndVerifyContract();

    // await interactWithContract(addressRegistry, proof);
}

void main().then(() => {
    process.exit(0);
});
