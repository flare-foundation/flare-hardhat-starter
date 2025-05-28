import { run, web3 } from "hardhat";
import { PaymentRegistryInstance } from "../../typechain-types";
import { prepareAttestationRequestBase, submitAttestationRequest, retrieveDataAndProofBaseWithRetry } from "./Base";

const Payment = artifacts.require("PaymentRegistry");

const { VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

// yarn hardhat run scripts/fdcExample/Payment.ts --network coston2

// Request data
const transactionId = "2A3E7C7F6077B4D12207A9F063515EACE70FBBF3C55514CD8BD659D4AB721447";
const inUtxo = "0";
const utxo = "0";

// Configuration constants
const attestationTypeBase = "Payment";
const sourceIdBase = "testXRP";
const verifierUrlBase = VERIFIER_URL_TESTNET;
const urlTypeBase = "xrp";

async function prepareAttestationRequest(transactionId: string, inUtxo: string, utxo: string) {
    const requestBody = {
        transactionId: transactionId,
        inUtxo: inUtxo,
        utxo: utxo,
    };

    const url = `${verifierUrlBase}verifier/${urlTypeBase}/Payment/prepareRequest`;
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
    const paymentRegistry: PaymentRegistryInstance = await Payment.new(...args);
    try {
        await run("verify:verify", {
            address: paymentRegistry.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log("Payment deployed to", paymentRegistry.address, "\n");
    return paymentRegistry;
}

async function interactWithContract(paymentRegistry: PaymentRegistryInstance, proof: any) {
    console.log("Proof hex:", proof.response_hex, "\n");

    // A piece of black magic that allows us to read the response type from an artifact
    const IPaymentVerification = await artifacts.require("IPaymentVerification");
    const responseType = IPaymentVerification._json.abi[0].inputs[0].components[1];
    console.log("Response type:", responseType, "\n");

    const decodedResponse = web3.eth.abi.decodeParameter(responseType, proof.response_hex);
    console.log("Decoded proof:", decodedResponse, "\n");
    const transaction = await paymentRegistry.registerPayment({
        merkleProof: proof.proof,
        data: decodedResponse,
    });
    console.log("Transaction:", transaction.tx, "\n");
    console.log("Verified payment:", await paymentRegistry.verifiedPayments(0), "\n");
}

async function main() {
    const data = await prepareAttestationRequest(transactionId, inUtxo, utxo);
    console.log("Data:", data, "\n");

    const abiEncodedRequest = data.abiEncodedRequest;
    const roundId = await submitAttestationRequest(abiEncodedRequest);

    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);

    const paymentRegistry: PaymentRegistryInstance = await deployAndVerifyContract();

    await interactWithContract(paymentRegistry, proof);
}

void main().then(() => {
    process.exit(0);
});
