// import { AddressRegistryInstance } from "../../typechain-types";
import {
    prepareAttestationRequestBase,
    submitAttestationRequest,
    retrieveDataAndProofBaseWithRetry,
} from "../utils/fdc";

const { VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

// yarn hardhat run scripts/fdcExample/ReferencedPaymentNonexistence.ts --network coston2

// Request data
// We prove that no payment with a specific reference was made to a specific destination
// within a given block range on the XRP testnet.
const minimalBlockNumber = "14950000";
const deadlineBlockNumber = "14950770";
const deadlineTimestamp = "1739720000";
const destinationAddressHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
const amount = "1000000";
const standardPaymentReference = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const checkSourceAddresses = false;
const sourceAddressesRoot = "0x0000000000000000000000000000000000000000000000000000000000000000";

// Configuration constants
const attestationTypeBase = "ReferencedPaymentNonexistence";
const sourceIdBase = "testXRP";
const verifierUrlBase = VERIFIER_URL_TESTNET;
const urlTypeBase = "xrp";

async function prepareAttestationRequest(
    minimalBlockNumber: string,
    deadlineBlockNumber: string,
    deadlineTimestamp: string,
    destinationAddressHash: string,
    amount: string,
    standardPaymentReference: string,
    checkSourceAddresses: string,
    sourceAddressesRoot: string
) {
    const requestBody = {
        minimalBlockNumber: minimalBlockNumber,
        deadlineBlockNumber: deadlineBlockNumber,
        deadlineTimestamp: deadlineTimestamp,
        destinationAddressHash: destinationAddressHash,
        amount: amount,
        standardPaymentReference: standardPaymentReference,
        checkSourceAddresses: checkSourceAddresses,
        sourceAddressesRoot: sourceAddressesRoot,
    };

    const url = `${verifierUrlBase}/verifier/${urlTypeBase}/ReferencedPaymentNonexistence/prepareRequest`;
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

async function main() {
    const data = await prepareAttestationRequest(
        minimalBlockNumber,
        deadlineBlockNumber,
        deadlineTimestamp,
        destinationAddressHash,
        amount,
        standardPaymentReference,
        checkSourceAddresses,
        sourceAddressesRoot
    );
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
