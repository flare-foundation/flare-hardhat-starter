import hre from "hardhat";
import { web3, artifacts, run } from "hardhat";
import { MetalPriceVerifierCustomFeedInstance, IRelayInstance, IFdcVerificationInstance } from "../../typechain-types";
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
} from "../utils/fdc";
import { IWeb2JsonVerification } from "../../typechain-types";

const MetalPriceVerifierCustomFeed = artifacts.require("MetalPriceVerifierCustomFeed");
const IWeb2JsonVerificationArtifact = artifacts.require("IWeb2JsonVerification");

const { WEB2JSON_VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL, METAL_SYMBOL } = process.env;

type AttestationRequest = {
    source: string;
    sourceIdBase: string;
    verifierUrlBase: string;
    verifierApiKey: string;
    urlTypeBase: string;
    data: any;
};

// --- Swissquote Metal Price Request Data ---
const metalSymbol = METAL_SYMBOL || "XAU"; // Default to Gold (XAU) if not set
const supportedMetals = ["XAU", "XAG", "XPT", "XPD"]; // Gold, Silver, Platinum, Palladium
if (!supportedMetals.includes(metalSymbol)) {
    throw new Error(`Unsupported METAL_SYMBOL: ${metalSymbol}. Must be one of ${supportedMetals.join(", ")}`);
}

const fullApiUrl = `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${metalSymbol}/USD`;
const postprocessJq = `{price: (.[0].spreadProfilePrices[0].ask * 10000 | floor)}`;
const abiSig = `{"components": [{"internalType": "uint256","name": "price","type": "uint256"}],"internalType": "struct MetalPriceData","name": "priceData","type": "tuple"}`;

const requests: AttestationRequest[] = [
    {
        source: "web2json",
        sourceIdBase: "PublicWeb2",
        verifierUrlBase: WEB2JSON_VERIFIER_URL_TESTNET!,
        verifierApiKey: VERIFIER_API_KEY_TESTNET!,
        urlTypeBase: "",
        data: {
            apiUrl: fullApiUrl,
            httpMethod: "GET",
            headers: "{}",
            queryParams: "{}",
            body: "{}",
            postProcessJq: postprocessJq,
            abiSignature: abiSig,
            logDisplayUrl: fullApiUrl,
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
        console.log(
            `Check round progress at: https://${hre.network.name}-systems-explorer.flare.rocks/voting-round/${roundId}?tab=fdc\n`
        );
        roundIds.set(source, roundId);
    }
    return roundIds;
}

async function retrieveDataAndProofs(
    data: Map<string, string>,
    roundIds: Map<string, number>
): Promise<Map<string, any>> {
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

async function retrieveDataAndProofsWithRetry(
    data: Map<string, string>,
    roundIds: Map<string, number>,
    attempts: number = 10
): Promise<Map<string, any>> {
    for (let i = 0; i < attempts; i++) {
        try {
            return await retrieveDataAndProofs(data, roundIds);
        } catch (error) {
            console.error(
                `Error retrieving proof (Attempt ${i + 1}/${attempts}):`,
                error,
                "\nRetrying in 20 seconds...\n"
            );
            await sleep(20000);
        }
    }
    throw new Error(`Failed to retrieve data and proofs after ${attempts} attempts.`);
}

async function deployAndVerifyContract(): Promise<MetalPriceVerifierCustomFeedInstance> {
    const feedIdString = `${metalSymbol}/USD`;
    const feedIdHex = toUtf8HexString(feedIdString).substring(2);
    const truncatedFeedIdHex = feedIdHex.substring(0, 40);
    const finalFeedIdHex = `0x21${truncatedFeedIdHex}`;

    if (finalFeedIdHex.length !== 44) {
        throw new Error(`Generated feed ID has incorrect length: ${finalFeedIdHex.length}. Expected 44 characters.`);
    }

    console.log(`\nDeploying MetalPriceVerifierCustomFeed for '${metalSymbol}' with Feed ID: ${finalFeedIdHex}...\n`);

    const customFeedArgs: any[] = [finalFeedIdHex, metalSymbol];
    const customFeed: MetalPriceVerifierCustomFeedInstance = await MetalPriceVerifierCustomFeed.new(...customFeedArgs);
    console.log(`MetalPriceVerifierCustomFeed deployed to: ${customFeed.address}\n`);
    console.log("Waiting 10 seconds before attempting verification on explorer...");
    await sleep(10000);

    try {
        await run("verify:verify", {
            address: customFeed.address,
            constructorArguments: customFeedArgs,
            contract: "contracts/customFeeds/MetalPriceVerifierCustomFeed.sol:MetalPriceVerifierCustomFeed",
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

async function prepareDataAndProofs(retrievedProofs: Map<string, any>) {
    const IWeb2JsonVerification = await artifacts.require("IWeb2JsonVerification");
    const proof = retrievedProofs.get("web2json");
    console.log(IWeb2JsonVerification._json.abi[0].inputs[0].components);
    return {
        merkleProof: proof.proof,
        data: web3.eth.abi.decodeParameter(
            IWeb2JsonVerification._json.abi[0].inputs[0].components[1],
            proof.response_hex || proof.data
        ),
    };
}

async function submitDataToCustomFeed(customFeed: MetalPriceVerifierCustomFeedInstance, proof: any) {
    console.log("\nSubmitting proof to MetalPriceVerifierCustomFeed contract...\n");
    console.log(
        "Proof argument being sent to contract:",
        JSON.stringify(proof, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2)
    );
    const tx = await customFeed.verifyPrice(proof);
    console.log(`Proof for ${metalSymbol}/USD submitted successfully. Transaction hash:`, tx.tx);
}

async function getLatestMetalPrice(customFeed: MetalPriceVerifierCustomFeedInstance) {
    console.log("\nRetrieving latest verified metal price from the contract...\n");
    const { _value, _decimals } = await customFeed.getFeedDataView();

    const formattedPrice = Number(_value) / 10 ** Number(_decimals);

    console.log(`Latest verified price for ${metalSymbol}/USD:`);
    console.log(`  - Price: $${formattedPrice.toFixed(4)}`);
    console.log(`  - (Raw contract value: ${_value.toString()}, Decimals: ${_decimals.toString()})`);
}

async function main() {
    if (!WEB2JSON_VERIFIER_URL_TESTNET || !VERIFIER_API_KEY_TESTNET || !COSTON2_DA_LAYER_URL) {
        throw new Error(
            "Missing required environment variables: WEB2JSON_VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, or COSTON2_DA_LAYER_URL"
        );
    }
    console.log(`--- Starting Metal Price Verification Script for ${metalSymbol}/USD ---`);
    console.log(`Fetching data from API: ${fullApiUrl}\n`);

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
    await getLatestMetalPrice(customFeed);

    console.log("\n--- Metal Price Verification Script Completed Successfully ---");
}

void main().then(() => {
    process.exit(0);
});
