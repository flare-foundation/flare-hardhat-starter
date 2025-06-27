import hre from "hardhat";
import { web3, artifacts, run } from "hardhat";
import { InflationCustomFeedInstance, IRelayInstance, IFdcVerificationInstance } from "../../typechain-types";
import {
    prepareAttestationRequestBase,
    getFdcHub,
    getFdcRequestFee,
    calculateRoundId,
    toUtf8HexString,
    getRelay,
    getFdcVerification,
    postRequestToDALayer,
    sleep,
} from "../fdcExample/Base";

const InflationCustomFeed = artifacts.require("InflationCustomFeed");
const IWeb2JsonVerificationArtifact = artifacts.require("IWeb2JsonVerification");


const { WEB2JSON_VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

type AttestationRequest = {
    source: string;
    sourceIdBase: string;
    verifierUrlBase: string;
    verifierApiKey: string;
    urlTypeBase: string;
    data: any;
};

// --- World Bank US Inflation CPI Request Data ---
const inflationDatasetIdentifier = "US_INFLATION_CPI_ANNUAL";
const targetYear = (new Date().getFullYear() - 2).toString();
const INDICATOR_CODE = "FP.CPI.TOTL.ZG"; // World Bank Indicator for Consumer Price Index, annual % change
const apiUrl = `https://api.worldbank.org/v2/country/US/indicator/${INDICATOR_CODE}`;
const stringifiedQueryParams = JSON.stringify({
    format: "json",
    date: targetYear,
});
const postprocessJq = `{inflationRate: (.[1][0].value | tonumber * 100 | floor), observationYear: (.[1][0].date | tonumber)}`;
const abiSig = `{"components": [{"internalType": "uint256","name": "inflationRate","type": "uint256"}, {"internalType": "uint256","name": "observationYear","type": "uint256"}],"internalType": "struct InflationData","name": "inflationData","type": "tuple"}`;

const requests: AttestationRequest[] = [
    {
        source: "web2json",
        sourceIdBase: "PublicWeb2",
        verifierUrlBase: WEB2JSON_VERIFIER_URL_TESTNET!,
        verifierApiKey: VERIFIER_API_KEY_TESTNET!,
        urlTypeBase: "",
        data: {
            apiUrl: apiUrl,
            httpMethod: "GET",
            headers: "{}",
            queryParams: stringifiedQueryParams,
            body: "{}",
            postProcessJq: postprocessJq,
            abiSignature: abiSig,
            logDisplayUrl: `${apiUrl}?format=json&date=${targetYear}`,
        },
    },
];

async function prepareWeb2JsonAttestationRequest(transaction: AttestationRequest) {
    const attestationTypeBase = "Web2Json";
    const requestBody = {
        url: transaction.data.apiUrl,
        httpMethod: transaction.data.httpMethod,
        headers: transaction.data.headers,
        queryParams: transaction.data.queryParams,
        body: transaction.data.body,
        postProcessJq: transaction.data.postProcessJq,
        abiSignature: transaction.data.abiSignature,
    };
    const url = `${transaction.verifierUrlBase}Web2Json/prepareRequest`;
    const apiKey = transaction.verifierApiKey;
    return await prepareAttestationRequestBase(url, apiKey, attestationTypeBase, transaction.sourceIdBase, requestBody);
}

/**
 * Prepares all attestation requests defined in the `requests` array.
 * @param transactions An array of attestation requests.
 * @returns A Map of source names to their ABI-encoded request strings.
 */
async function prepareAttestationRequests(transactions: AttestationRequest[]): Promise<Map<string, string>> {
    console.log("\nPreparing attestation requests for FDC...\n");
    const data: Map<string, string> = new Map();
    for (const transaction of transactions) {
        console.log(`Preparing request for source: '${transaction.source}'\n`);
        const responseData = await prepareWeb2JsonAttestationRequest(transaction);
        console.log("Prepared Request Data:", responseData, "\n");
        data.set(transaction.source, responseData.abiEncodedRequest);
    }
    return data;
}

/**
 * Submits the prepared attestation requests to the FDC Hub.
 * @param data A Map of source names to their ABI-encoded requests.
 * @returns A Map of source names to their corresponding voting round IDs.
 */
async function submitAttestationRequests(data: Map<string, string>): Promise<Map<string, number>> {
    console.log("\nSubmitting attestation requests to FDC Hub...\n");
    const fdcHub = await getFdcHub();
    const roundIds: Map<string, number> = new Map();
    for (const [source, abiEncodedRequest] of data.entries()) {
        console.log(`Submitting request for source: '${source}'\n`);
        const requestFee = await getFdcRequestFee(abiEncodedRequest);
        const transaction = await fdcHub.requestAttestation(abiEncodedRequest, { value: requestFee });
        console.log("Submitted request transaction:", transaction.tx, "\n");
        const roundId = await calculateRoundId(transaction);
        console.log(`Attestation requested in round ${roundId}.`);
        console.log(`Check round progress at: https://${hre.network.name}-systems-explorer.flare.rocks/voting-round/${roundId}?tab=fdc\n`);
        roundIds.set(source, roundId);
    }
    return roundIds;
}

async function retrieveDataAndProofs(data: Map<string, string>, roundIds: Map<string, number>): Promise<Map<string, any>> {
    console.log("\nRetrieving data and proofs from DA Layer...\n");
    const proofs: Map<string, any> = new Map();
    const url = `${COSTON2_DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
    console.log("Using DA Layer URL:", url, "\n");

    for (const [source, roundId] of roundIds.entries()) {
        console.log(`Processing proof for source: '${source}' (Round ${roundId})\n`);
        console.log("Waiting for the round to finalize...");
        const relay: IRelayInstance = await getRelay();
        const protocolId = 200; // Protocol ID for FDC

        while (!(await relay.isFinalized(protocolId, roundId))) {
            await sleep(10000); // Wait 10 seconds before checking again
        }
        console.log(`Round ${roundId} finalized!\n`);

        const request = { votingRoundId: roundId, requestBytes: data.get(source) };
        console.log("Prepared DA Layer request:\n", request, "\n");

        let proof = await postRequestToDALayer(url, request, true);
        console.log("Waiting for the DA Layer to generate the proof...");
        while (proof.response_hex == undefined) {
            await sleep(10000);
            proof = await postRequestToDALayer(url, request, false);
        }
        console.log("Proof generated!\n");
        console.log("Retrieved Proof:", proof, "\n");
        proofs.set(source, proof);
    }
    return proofs;
}

async function retrieveDataAndProofsWithRetry(data: Map<string, string>, roundIds: Map<string, number>, attempts: number = 10): Promise<Map<string, any>> {
    for (let i = 0; i < attempts; i++) {
        try {
            return await retrieveDataAndProofs(data, roundIds);
        } catch (error) {
            console.error(`Error retrieving proof (Attempt ${i + 1}/${attempts}):`, error, "\nRetrying in 20 seconds...\n");
            await sleep(20000);
        }
    }
    throw new Error(`Failed to retrieve data and proofs after ${attempts} attempts.`);
}

async function deployAndVerifyContract(): Promise<InflationCustomFeedInstance> {
    const feedIdString = `INFLATION/${inflationDatasetIdentifier}`;
    const feedIdHex = toUtf8HexString(feedIdString).substring(2);
    const truncatedFeedIdHex = feedIdHex.substring(0, 40);
    const finalFeedIdHex = `0x21${truncatedFeedIdHex}`;

    if (finalFeedIdHex.length !== 44) {
        throw new Error(`Generated feed ID has incorrect length: ${finalFeedIdHex.length}. Expected 44 characters.`);
    }

    console.log(`\nDeploying InflationCustomFeed for '${inflationDatasetIdentifier}' with Feed ID: ${finalFeedIdHex}...\n`);

    const customFeedArgs: any[] = [finalFeedIdHex, inflationDatasetIdentifier];
    const customFeed: InflationCustomFeedInstance = await InflationCustomFeed.new(...customFeedArgs);
    console.log(`InflationCustomFeed deployed to: ${customFeed.address}\n`);
    console.log("Waiting 10 seconds before attempting verification on explorer...");
    await sleep(10000);

    try {
        await run("verify:verify", {
            address: customFeed.address,
            constructorArguments: customFeedArgs,
            contract: "contracts/customFeeds/InflationCustomFeed.sol:InflationCustomFeed",
        });
        console.log("Contract verification successful.\n");
    } catch (e: any) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Contract is already verified.\n");
        } else {
            console.error("Contract verification failed:", e.message, "\n");
        }
    }
    return customFeed;
}

async function prepareDataAndProofs(data: Map<string, any>) {
    const IWeb2JsonVerification = await artifacts.require("IWeb2JsonVerification");
    const proof = data.get("web2json");
    console.log(IWeb2JsonVerification._json.abi[0].inputs[0].components)
    return {
        merkleProof: proof.merkleProof,
        data: web3.eth.abi.decodeParameter(
            IWeb2JsonVerification._json.abi[0].inputs[0].components[1],
            proof.data || proof.response_hex
        ),
    };
}

async function submitDataToCustomFeed(customFeed: InflationCustomFeedInstance, proof: any) {
    console.log('\nSubmitting proof to InflationCustomFeed contract...\n');
    console.log('Proof argument being sent to contract:', JSON.stringify(proof, (k,v) => typeof v === 'bigint' ? v.toString() : v, 2));
    const tx = await customFeed.verifyInflationData(proof);
    console.log(`Proof for ${inflationDatasetIdentifier} submitted successfully. Transaction hash:`, tx.tx);
}

async function getLatestInflationData(customFeed: InflationCustomFeedInstance) {
    console.log("\nRetrieving latest verified inflation data from the contract...\n");
    const { _value, _decimals, _observationYear, _verifiedTimestamp } = await customFeed.getFeedDataView();
    
    const formattedInflation = (Number(_value) / (10 ** Number(_decimals))) * 100;

    console.log(`Latest verified data for ${inflationDatasetIdentifier}:`);
    console.log(`  - Inflation Rate: ${formattedInflation.toFixed(2)}%`);
    console.log(`  - (Raw contract value: ${_value.toString()}, Decimals: ${_decimals.toString()})`);
    console.log(`  - Observation Year: ${_observationYear.toString()}`);
    console.log(`  - Verified On-Chain (Timestamp): ${_verifiedTimestamp.toString()} (${new Date(Number(_verifiedTimestamp) * 1000).toUTCString()})`);
}

async function main() {
    if (!WEB2JSON_VERIFIER_URL_TESTNET || !VERIFIER_API_KEY_TESTNET || !COSTON2_DA_LAYER_URL) {
        throw new Error(
            "Missing required environment variables: WEB2JSON_VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, or COSTON2_DA_LAYER_URL"
        );
    }
    console.log(`--- Starting Inflation Data Verification Script for ${inflationDatasetIdentifier} ---`);
    console.log(`Fetching data for year: ${targetYear} from API: ${apiUrl}?format=json&date=${targetYear}\n`);
    
    const customFeed = await deployAndVerifyContract();
    const data = await prepareAttestationRequests(requests);
    const roundIds = await submitAttestationRequests(data);
    const retrievedProofs = await retrieveDataAndProofsWithRetry(data, roundIds);
    const decodedProof = await prepareDataAndProofs(retrievedProofs);
    const proof = {
        merkleProof: retrievedProofs.get("web2json").proof,
        data: decodedProof.data,
    };

    await submitDataToCustomFeed(customFeed, proof);
    await getLatestInflationData(customFeed);

    console.log("\n--- Inflation Data Verification Script Completed Successfully ---");
}

void main().then(() => {
    process.exit(0);
});