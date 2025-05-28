import { run, web3 } from "hardhat";
import { TransferEventListenerInstance } from "../../typechain-types";
import { prepareAttestationRequestBase, submitAttestationRequest, retrieveDataAndProofBaseWithRetry } from "./Base";

const TransferEventListener = artifacts.require("TransferEventListener");

const { VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

// yarn hardhat run scripts/fdcExample/EVMTransaction.ts --network coston2

// Request data
const transactionHash = "0x4e636c6590b22d8dcdade7ee3b5ae5572f42edb1878f09b3034b2f7c3362ef3c";

// Configuration constants
const attestationTypeBase = "EVMTransaction";
const sourceIdBase = "testETH";
const verifierUrlBase = VERIFIER_URL_TESTNET;
const urlTypeBase = "eth";

async function prepareAttestationRequest(transactionHash: string) {
    const requiredConfirmations = "1";
    const provideInput = true;
    const listEvents = true;
    const logIndices: string[] = [];

    const requestBody = {
        transactionHash: transactionHash,
        requiredConfirmations: requiredConfirmations,
        provideInput: provideInput,
        listEvents: listEvents,
        logIndices: logIndices,
    };

    const url = `${verifierUrlBase}verifier/${urlTypeBase}/EVMTransaction/prepareRequest`;
    const apiKey = VERIFIER_API_KEY_TESTNET;

    return await prepareAttestationRequestBase(url, apiKey, attestationTypeBase, sourceIdBase, requestBody);
}

async function retrieveDataAndProof(abiEncodedRequest: string, roundId: number) {
    const url = `${COSTON2_DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
    console.log("Url:", url, "\n");
    return await retrieveDataAndProofBaseWithRetry(url, abiEncodedRequest, roundId);
}

async function deployAndVerifyContract() {
    const args: any[] = [];
    const eventListener: TransferEventListenerInstance = await TransferEventListener.new(...args);
    try {
        await run("verify:verify", {
            address: eventListener.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log("TransferEventListener deployed to", eventListener.address, "\n");
    return eventListener;
}

async function interactWithContract(eventListener: TransferEventListenerInstance, proof: any) {
    console.log("Proof hex:", proof.response_hex, "\n");

    // A piece of black magic that allows us to read the response type from an artifact
    const IEVMTransactionVerification = await artifacts.require("IEVMTransactionVerification");
    const responseType = IEVMTransactionVerification._json.abi[0].inputs[0].components[1];
    console.log("Response type:", responseType, "\n");

    const decodedResponse = web3.eth.abi.decodeParameter(responseType, proof.response_hex);
    console.log("Decoded proof:", decodedResponse, "\n");
    const transaction = await eventListener.collectTransferEvents({
        merkleProof: proof.proof,
        data: decodedResponse,
    });
    console.log("Transaction:", transaction.tx, "\n");
    console.log("Token transfer:", await eventListener.tokenTransfers(0), "\n");
}

async function main() {
    const data = await prepareAttestationRequest(transactionHash);
    console.log("Data:", data, "\n");

    const abiEncodedRequest = data.abiEncodedRequest;
    const roundId = await submitAttestationRequest(abiEncodedRequest);

    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);

    const eventListener: TransferEventListenerInstance = await deployAndVerifyContract();

    await interactWithContract(eventListener, proof);
}

void main().then(() => {
    process.exit(0);
});
