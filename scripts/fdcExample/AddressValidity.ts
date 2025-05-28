import { run, web3 } from "hardhat";
import { AddressRegistryInstance } from "../../typechain-types";
import { prepareAttestationRequestBase, submitAttestationRequest, retrieveDataAndProofBaseWithRetry } from "./Base";

const AddressRegistry = artifacts.require("AddressRegistry");

const { VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

// yarn hardhat run scripts/fdcExample/AddressValidity.ts --network coston2

// Request data
const addressStr = "mg9P9f4wr9w7c1sgFeiTC5oMLYXCc2c7hs";

// Configuration constants
const attestationTypeBase = "AddressValidity";
const sourceIdBase = "testBTC";
const verifierUrlBase = VERIFIER_URL_TESTNET;
const urlTypeBase = "btc";

async function prepareAttestationRequest(addressStr: string) {
    const requestBody = {
        addressStr: addressStr,
    };

    const url = `${verifierUrlBase}verifier/${urlTypeBase}/AddressValidity/prepareRequest`;
    const apiKey = VERIFIER_API_KEY_TESTNET ?? "";

    return await prepareAttestationRequestBase(url, apiKey, attestationTypeBase, sourceIdBase, requestBody);
}

async function retrieveDataAndProof(abiEncodedRequest: string, roundId: number) {
    const url = `${COSTON2_DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
    console.log("Url:", url, "\n");
    return await retrieveDataAndProofBaseWithRetry(url, abiEncodedRequest, roundId);
}

async function deployAndVerifyContract() {
    const args: any[] = [];
    const addressRegistry: AddressRegistryInstance = await AddressRegistry.new(...args);
    try {
        await run("verify:verify", {
            address: addressRegistry.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log("AddressRegistry deployed to", addressRegistry.address, "\n");
    return addressRegistry;
}

async function interactWithContract(addressRegistry: AddressRegistryInstance, proof: any) {
    console.log("Proof hex:", proof.response_hex, "\n");

    // A piece of black magic that allows us to read the response type from an artifact
    const IAddressValidityVerification = await artifacts.require("IAddressValidityVerification");
    const responseType = IAddressValidityVerification._json.abi[0].inputs[0].components[1];
    console.log("Response type:", responseType, "\n");

    const decodedResponse = web3.eth.abi.decodeParameter(responseType, proof.response_hex);
    console.log("Decoded proof:", decodedResponse, "\n");
    const transaction = await addressRegistry.registerAddress({
        merkleProof: proof.proof,
        data: decodedResponse,
    });
    console.log("Transaction:", transaction.tx, "\n");
    console.log("Verified address:", await addressRegistry.verifiedAddresses(0), "\n");
}

async function main() {
    const data = await prepareAttestationRequest(addressStr);
    console.log("Data:", data, "\n");

    const abiEncodedRequest = data.abiEncodedRequest;
    const roundId = await submitAttestationRequest(abiEncodedRequest);

    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);

    const addressRegistry: AddressRegistryInstance = await deployAndVerifyContract();

    await interactWithContract(addressRegistry, proof);
}

void main().then(() => {
    process.exit(0);
});
