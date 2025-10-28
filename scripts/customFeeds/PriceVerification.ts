import { artifacts, web3, run } from "hardhat";
import { PriceVerifierCustomFeedInstance } from "../../typechain-types";
import {
    prepareAttestationRequestBase,
    submitAttestationRequest,
    retrieveDataAndProofBaseWithRetry,
} from "../utils/fdc";

const PriceVerifierCustomFeed = artifacts.require("PriceVerifierCustomFeed");

const { WEB2JSON_VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

// --- Configuration Constants ---
const priceSymbol = "BTC";
const priceDecimals = 2;
const coinGeckoId = "bitcoin";

// --- CoinGecko BTC Price Request Data ---
const dateToFetch = new Date();
dateToFetch.setDate(dateToFetch.getDate() - 2); // Fetch a historical price to ensure it's final
const day = String(dateToFetch.getDate()).padStart(2, "0");
const month = String(dateToFetch.getMonth() + 1).padStart(2, "0");
const year = dateToFetch.getFullYear();
const dateString = `${day}-${month}-${year}`;
const fullApiUrl = `https://api.coingecko.com/api/v3/coins/${coinGeckoId}/history`;
const postprocessJq = `{price: (.market_data.current_price.usd * ${10 ** priceDecimals} | floor)}`;
const abiSig = `{"components": [{"internalType": "uint256","name": "price","type": "uint256"}],"internalType": "struct PriceData","name": "priceData","type": "tuple"}`;
const stringifiedQueryParams = JSON.stringify({
    date: dateString,
    localization: "false",
});

// --- FDC Configuration ---
const attestationTypeBase = "Web2Json";
const sourceIdBase = "PublicWeb2";
const verifierUrlBase = WEB2JSON_VERIFIER_URL_TESTNET;

/**
 * Prepares the attestation request by calling the shared utility function.
 */
async function prepareAttestationRequest() {
    console.log("\nPreparing data...");
    const requestBody = {
        url: fullApiUrl,
        httpMethod: "GET",
        headers: "{}",
        queryParams: stringifiedQueryParams,
        body: "{}",
        postProcessJq: postprocessJq,
        abiSignature: abiSig,
    };
    const url = `${verifierUrlBase}Web2Json/prepareRequest`;
    const apiKey = VERIFIER_API_KEY_TESTNET;
    return await prepareAttestationRequestBase(url, apiKey, attestationTypeBase, sourceIdBase, requestBody);
}

/**
 * Retrieves the data and proof by calling the shared utility function with a retry mechanism.
 */
async function retrieveDataAndProof(abiEncodedRequest: string, roundId: number) {
    console.log("\nRetrieving data and proof...");
    const url = `${COSTON2_DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
    return await retrieveDataAndProofBaseWithRetry(url, abiEncodedRequest, roundId);
}

/**
 * Deploys and verifies the PriceVerifierCustomFeed contract.
 */
async function deployAndVerifyContract(): Promise<PriceVerifierCustomFeedInstance> {
    const feedIdString = `${priceSymbol}/USD-HIST`;
    // Use keccak256 for a standard, fixed-length hash of the feed name.
    const feedNameHash = web3.utils.keccak256(feedIdString);
    // Construct the final feed ID: 0x21 (custom feed category) + first 20 bytes of the hash.
    const finalFeedIdHex = `0x21${feedNameHash.substring(2, 42)}`;

    console.log(`\nDeploying PriceVerifierCustomFeed with Feed ID: ${finalFeedIdHex}`);
    const customFeedArgs: any[] = [finalFeedIdHex, priceSymbol, priceDecimals];
    const customFeed: PriceVerifierCustomFeedInstance = await PriceVerifierCustomFeed.new(...customFeedArgs);
    console.log(`✅ PriceVerifierCustomFeed deployed to: ${customFeed.address}`);

    try {
        await run("verify:verify", {
            address: customFeed.address,
            constructorArguments: customFeedArgs,
            contract: "contracts/customFeeds/PriceVerifierCustomFeed.sol:PriceVerifierCustomFeed",
        });
        console.log("✅ Contract verification successful.");
    } catch (error) {
        console.log("Contract verification failed:", error);
    }
    return customFeed;
}

/**
 * Decodes the proof and submits it to the deployed custom feed contract.
 */
async function interactWithContract(customFeed: PriceVerifierCustomFeedInstance, proof: any) {
    console.log("\nSubmitting proof to custom feed contract...");

    // Decode the raw hex proof into the struct the contract expects.
    const IWeb2JsonVerification = await artifacts.require("IWeb2JsonVerification");
    const responseType = IWeb2JsonVerification._json.abi[0].inputs[0].components[1];
    const decodedResponse = web3.eth.abi.decodeParameter(responseType, proof.response_hex);

    const fullProof = {
        merkleProof: proof.proof,
        data: decodedResponse,
    };

    const tx = await customFeed.verifyPrice(fullProof);
    console.log(`✅ Proof for ${priceSymbol} submitted successfully. Tx: ${tx.tx}`);

    // Read the price back from the contract to confirm it was stored.
    const { _value, _decimals } = await customFeed.getFeedDataView();
    const formattedPrice = Number(_value) / 10 ** Number(_decimals);
    console.log(`✅ Latest verified price for ${priceSymbol}/USD: $${formattedPrice}`);
}

async function main() {
    if (!verifierUrlBase || !VERIFIER_API_KEY_TESTNET || !COSTON2_DA_LAYER_URL) {
        throw new Error("Missing one or more required environment variables.");
    }
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

    console.log("\n🎉 Price verification process completed successfully. 🎉");
}

void main().then(() => {
    process.exit(0);
});
