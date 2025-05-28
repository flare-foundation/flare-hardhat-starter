import { run, web3 } from "hardhat";
// import { AddressRegistryInstance } from "../../typechain-types";
import { prepareAttestationRequestBase, submitAttestationRequest, retrieveDataAndProofBaseWithRetry } from "./Base";

const { VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

// yarn hardhat run scripts/fdcExample/ConfirmedBlockHeightExists.ts --network coston2

// Request data
const blockNumber = "5004226";
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

    const url = `${verifierUrlBase}verifier/${urlTypeBase}/ConfirmedBlockHeightExists/prepareRequest`;
    const apiKey = VERIFIER_API_KEY_TESTNET ?? "";

    return await prepareAttestationRequestBase(url, apiKey, attestationTypeBase, sourceIdBase, requestBody);
}

async function retrieveDataAndProof(abiEncodedRequest: string, roundId: number) {
    const url = `${COSTON2_DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
    console.log("Url:", url, "\n");
    return await retrieveDataAndProofBaseWithRetry(url, abiEncodedRequest, roundId);
}

async function deployAndVerifyContract() {}

async function interactWithContract() {}

async function main() {
    const data = await prepareAttestationRequest(blockNumber, queryWindow);
    console.log("Data:", data, "\n");

    const abiEncodedRequest = data.abiEncodedRequest;
    const roundId = await submitAttestationRequest(abiEncodedRequest);

    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);

    // const addressRegistry: AddressRegistryInstance =
    //   await deployAndVerifyContract();

    // await interactWithContract(addressRegistry, proof);
}

void main().then(() => {
    process.exit(0);
});
