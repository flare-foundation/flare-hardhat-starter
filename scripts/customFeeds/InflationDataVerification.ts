import { artifacts, web3, run } from "hardhat";
import { InflationCustomFeedInstance } from "../../typechain-types";
import {
    prepareAttestationRequestBase,
    submitAttestationRequest,
    retrieveDataAndProofBaseWithRetry,
} from "../utils/fdc";

const InflationCustomFeed = artifacts.require("InflationCustomFeed");

const { VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

// --- Configuration Constants ---
const inflationDatasetIdentifier = "US_INFLATION_CPI_ANNUAL";
const targetYear = (new Date().getFullYear() - 2).toString(); // Use a finalized year
const INDICATOR_CODE = "FP.CPI.TOTL.ZG"; // World Bank Indicator for CPI, annual %

// --- World Bank API Request Data ---
const apiUrl = `https://api.worldbank.org/v2/country/US/indicator/${INDICATOR_CODE}`;
const stringifiedQueryParams = JSON.stringify({ format: "json", date: targetYear });
const postprocessJq = `{inflationRate: (.[1][0].value | tonumber * 100 | floor), observationYear: (.[1][0].date | tonumber)}`;
const abiSig = `{"components": [{"internalType": "uint256","name": "inflationRate","type": "uint256"}, {"internalType": "uint256","name": "observationYear","type": "uint256"}],"internalType": "struct InflationData","name": "inflationData","type": "tuple"}`;

// --- FDC Configuration ---
const attestationTypeBase = "Web2Json";
const sourceIdBase = "PublicWeb2";
const verifierUrlBase = VERIFIER_URL_TESTNET;

/**
 * Prepares the attestation request using the shared utility function.
 */
async function prepareAttestationRequest() {
    console.log("\nPreparing data...");
    const requestBody = {
        url: apiUrl,
        httpMethod: "GET",
        headers: "{}",
        queryParams: stringifiedQueryParams,
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
 * Deploys and verifies the InflationCustomFeed contract.
 */
async function deployAndVerifyContract(): Promise<InflationCustomFeedInstance> {
    const feedIdString = `INFLATION/${inflationDatasetIdentifier}`;
    const feedNameHash = web3.utils.keccak256(feedIdString);
    const finalFeedIdHex = `0x21${feedNameHash.substring(2, 42)}`;

    console.log(
        `\nDeploying InflationCustomFeed for '${inflationDatasetIdentifier}' with Feed ID: ${finalFeedIdHex}...`
    );
    const customFeedArgs: any[] = [finalFeedIdHex, inflationDatasetIdentifier];
    const customFeed: InflationCustomFeedInstance = await InflationCustomFeed.new(...customFeedArgs);
    console.log(`✅ InflationCustomFeed deployed to: ${customFeed.address}`);

    try {
        await run("verify:verify", {
            address: customFeed.address,
            constructorArguments: customFeedArgs,
            contract: "contracts/customFeeds/InflationCustomFeed.sol:InflationCustomFeed",
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
async function interactWithContract(customFeed: InflationCustomFeedInstance, proof: any) {
    console.log("\nSubmitting proof to InflationCustomFeed contract...");

    // Decode the raw hex proof into the struct the contract expects
    const IWeb2JsonVerification = await artifacts.require("IWeb2JsonVerification");
    const responseType = IWeb2JsonVerification._json.abi[0].inputs[0].components[1];
    const decodedResponse = web3.eth.abi.decodeParameter(responseType, proof.response_hex);

    const fullProof = {
        merkleProof: proof.proof,
        data: decodedResponse,
    };

    const tx = await customFeed.verifyInflationData(fullProof);
    console.log(`✅ Proof for ${inflationDatasetIdentifier} submitted successfully. Tx: ${tx.tx}`);

    // Read the data back from the contract to confirm it was stored
    const { _value, _decimals, _observationYear } = await customFeed.getFeedDataView();
    const formattedInflation = (Number(_value) / 10 ** Number(_decimals)) * 100;
    console.log(`✅ Latest verified inflation rate for year ${_observationYear}: ${formattedInflation.toFixed(2)}%`);
}

async function main() {
    if (!verifierUrlBase || !VERIFIER_API_KEY_TESTNET || !COSTON2_DA_LAYER_URL) {
        throw new Error("Missing one or more required environment variables.");
    }
    console.log(`--- Starting Inflation Data Verification for ${targetYear} ---`);

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

    console.log("\n🎉 Inflation data verification process completed successfully. 🎉");
}

void main().then(() => {
    process.exit(0);
});
