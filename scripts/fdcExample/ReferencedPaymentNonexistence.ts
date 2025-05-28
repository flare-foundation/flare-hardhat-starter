import { run, web3 } from "hardhat";
// import { AddressRegistryInstance } from "../../typechain-types";
import { prepareAttestationRequestBase, submitAttestationRequest, retrieveDataAndProofBaseWithRetry } from "./Base";

const { VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

// yarn hardhat run scripts/fdcExample/ReferencedPaymentNonexistence.ts --network coston2

// Request data
const minimalBlockNumber = "TODO";
const deadlineBlockNumber = "TODO";
const deadlineTimestamp = "TODO";
const destinationAddressHash = "TODO";
const amount = "TODO";
const standardPaymentReference = "TODO";
const checkSourceAddresses = "TODO";
const sourceAddressesRoot = "TODO";

// Configuration constants
const attestationTypeBase = "ReferencedPaymentNonexistence";
const sourceIdBase = "testBTC";
const verifierUrlBase = VERIFIER_URL_TESTNET;
const urlTypeBase = "btc";

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

    const url = `${verifierUrlBase}verifier/${urlTypeBase}/ReferencedPaymentNonexistence/prepareRequest`;
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

    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);

    // const addressRegistry: AddressRegistryInstance =
    //   await deployAndVerifyContract();

    // await interactWithContract(addressRegistry, proof);
}

void main().then(() => {
    process.exit(0);
});
