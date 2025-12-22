import { artifacts, web3, run } from "hardhat";
import { MetalPriceVerifierCustomFeedInstance } from "../../typechain-types";
import {
    prepareAttestationRequestBase,
    submitAttestationRequest,
    retrieveDataAndProofBaseWithRetry,
} from "../utils/fdc";

const MetalPriceVerifierCustomFeed = artifacts.require("MetalPriceVerifierCustomFeed");

const { WEB2JSON_VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

// --- Configuration Constants ---
const metalSymbol = "XAU";
const supportedMetals = ["XAU", "XAG", "XPT", "XPD"];
if (!supportedMetals.includes(metalSymbol)) {
    throw new Error(`Unsupported METAL_SYMBOL: ${metalSymbol}. Must be one of ${supportedMetals.join(", ")}`);
}

// --- Swissquote Metal Price Request Data ---
const fullApiUrl = `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${metalSymbol}/USD`;
const postprocessJq = `{price: (.[0].spreadProfilePrices[0].ask * 10000 | floor)}`; // Multiply to get 4 decimal places of precision
const abiSig = `{"components": [{"internalType": "uint256","name": "price","type": "uint256"}],"internalType": "struct MetalPriceData","name": "priceData","type": "tuple"}`;

// --- FDC Configuration ---
const attestationTypeBase = "Web2Json";
const sourceIdBase = "PublicWeb2";
const verifierUrlBase = WEB2JSON_VERIFIER_URL_TESTNET;

/**
 * Prepares the attestation request using the shared utility function.
 */
async function prepareAttestationRequest() {
    console.log("\nPreparing data...");
    const requestBody = {
        url: fullApiUrl,
        httpMethod: "GET",
        headers: "{}",
        queryParams: "{}",
        body: "{}",
        postProcessJq: postprocessJq,
        abiSignature: abiSig,
    };
    const url = `${verifierUrlBase}/Web2Json/prepareRequest`;
    const apiKey = VERIFIER_API_KEY_TESTNET;
    return await prepareAttestationRequestBase(url, apiKey, attestationTypeBase, sourceIdBase, requestBody);
}

/**
 * Retrieves the data and proof using the shared utility function with retries.
 */
async function retrieveDataAndProof(abiEncodedRequest: string, roundId: number) {
    console.log("\nRetrieving data and proof...");
    const url = `${COSTON2_DA_LAYER_URL}/api/v1/fdc/proof-by-request-round-raw`;
    return await retrieveDataAndProofBaseWithRetry(url, abiEncodedRequest, roundId);
}

/**
 * Deploys and verifies the MetalPriceVerifierCustomFeed contract.
 */
async function deployAndVerifyContract(): Promise<MetalPriceVerifierCustomFeedInstance> {
    const feedIdString = `${metalSymbol}/USD`;
    const feedNameHash = web3.utils.keccak256(feedIdString);
    const finalFeedIdHex = `0x21${feedNameHash.substring(2, 42)}`;

    console.log(`\nDeploying MetalPriceVerifierCustomFeed for '${metalSymbol}' with Feed ID: ${finalFeedIdHex}...`);
    const customFeedArgs: any[] = [finalFeedIdHex, metalSymbol];
    const customFeed: MetalPriceVerifierCustomFeedInstance = await MetalPriceVerifierCustomFeed.new(...customFeedArgs);
    console.log(`✅ MetalPriceVerifierCustomFeed deployed to: ${customFeed.address}`);

    try {
        await run("verify:verify", {
            address: customFeed.address,
            constructorArguments: customFeedArgs,
            contract: "contracts/customFeeds/MetalPriceVerifierCustomFeed.sol:MetalPriceVerifierCustomFeed",
        });
        console.log("✅ Contract verification successful.");
    } catch (e: any) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Contract is already verified.");
        } else {
            console.error("Contract verification failed:", e.message);
        }
    }
    return customFeed;
}

/**
 * Decodes the proof and submits it to the deployed custom feed contract.
 */
async function interactWithContract(customFeed: MetalPriceVerifierCustomFeedInstance, proof: any) {
    console.log("\nSubmitting proof to MetalPriceVerifierCustomFeed contract...");

    const IWeb2JsonVerification = await artifacts.require("IWeb2JsonVerification");
    const responseType = IWeb2JsonVerification._json.abi[0].inputs[0].components[1];
    const decodedResponse = web3.eth.abi.decodeParameter(responseType, proof.response_hex);

    const fullProof = {
        merkleProof: proof.proof,
        data: decodedResponse,
    };

    const tx = await customFeed.verifyPrice(fullProof);
    console.log(`✅ Proof for ${metalSymbol}/USD submitted successfully. Tx: ${tx.tx}`);

    const { _value, _decimals } = await customFeed.getFeedDataView();
    const formattedPrice = Number(_value) / 10 ** Number(_decimals);
    console.log(`✅ Latest verified price for ${metalSymbol}/USD: $${formattedPrice.toFixed(4)}`);
}

async function main() {
    if (!verifierUrlBase || !VERIFIER_API_KEY_TESTNET || !COSTON2_DA_LAYER_URL) {
        throw new Error("Missing one or more required environment variables.");
    }
    console.log(`--- Starting Metal Price Verification Script for ${metalSymbol}/USD ---`);

    // 1. Prepare
    const data = await prepareAttestationRequest();
    console.log("Prepared Data:", data);

    // 2. Submit
    const abiEncodedRequest = data.abiEncodedRequest;
    const roundId = await submitAttestationRequest(abiEncodedRequest);

    // 3. Retrieve
    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);

    // 4. Deploy
    const customFeed = await deployAndVerifyContract();

    // 5. Interact
    await interactWithContract(customFeed, proof);

    console.log("\n🎉 Metal Price Verification Script Completed Successfully. 🎉");
}

void main().then(() => {
    process.exit(0);
});
