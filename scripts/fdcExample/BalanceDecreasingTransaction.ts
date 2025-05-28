import { web3 } from "hardhat";
// import { AddressRegistryInstance } from "../../typechain-types";
import { prepareAttestationRequestBase, submitAttestationRequest, retrieveDataAndProofBaseWithRetry } from "./Base";

const { VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

// yarn hardhat run scripts/fdcExample/BalanceDecreasingTransaction.ts --network coston2

// Request data
const transactionId = "CDBAF39222C04C9FD3AE0FA54B144FFA6D580ABDB0A888EA5B1CFDDEE282156F";
const sourceAddress = "rGpGUdqUAVkNVr4Hfkvay7ffB7vjoA31uT";

// Configuration constants
const attestationTypeBase = "BalanceDecreasingTransaction";
const sourceIdBase = "testXRP";
const verifierUrlBase = VERIFIER_URL_TESTNET;
const urlTypeBase = "xrp";

async function prepareAttestationRequest(transactionId: string, sourceAddress: string) {
    const sourceAddressIndicator = web3.utils.keccak256(sourceAddress);

    const requestBody = {
        transactionId: transactionId,
        sourceAddressIndicator: sourceAddressIndicator,
    };

    const url = `${verifierUrlBase}verifier/${urlTypeBase}/BalanceDecreasingTransaction/prepareRequest`;
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
    const data = await prepareAttestationRequest(transactionId, sourceAddress);
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
