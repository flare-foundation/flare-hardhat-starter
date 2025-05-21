import { ethers } from "ethers";
import { run } from "hardhat";
import { MetalPriceVerifierCustomFeedInstance } from "../typechain-types";
import {
    prepareAttestationRequestBase,
    submitAttestationRequest,
    retrieveDataAndProofBase,
    toUtf8HexString,
} from "./fdcExample/Base";
import { coston } from "@flarenetwork/flare-periphery-contract-artifacts";

const MetalPriceVerifierCustomFeed = artifacts.require("MetalPriceVerifierCustomFeed");

const { JQ_VERIFIER_URL_TESTNET, JQ_VERIFIER_API_KEY, COSTON_DA_LAYER_URL, METAL_SYMBOL } = process.env;

// --- Request Configuration ---

// 1. Define the metal to fetch from environment variable or default
const metalSymbol = METAL_SYMBOL || "XAU"; // Default to Gold (XAU) if not set
const supportedMetals = ["XAU", "XAG", "XPT"];
if (!supportedMetals.includes(metalSymbol)) {
    throw new Error(`Unsupported METAL_SYMBOL: ${metalSymbol}. Must be one of ${supportedMetals.join(", ")}`);
}
console.log(`Fetching price for: ${metalSymbol}/USD`);

// 2. Construct the API URL
const apiUrl = `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${metalSymbol}/USD`;
console.log(`API URL: ${apiUrl}`);

// 3. JQ Filter to extract the 'ask' price from Swissquote and format it (times 10000 for 4 decimals)
// Assumes the response is an array, takes the first element, then the first spread profile price's 'ask' value.
const postprocessJq = `{price: (.[0].spreadProfilePrices[0].ask * 10000 | floor)}`;
console.log(`JQ Filter: ${postprocessJq}`);

// 4. ABI Signature matching the MetalPriceData struct in Solidity
const abiSignature = `{"components": [{"internalType": "uint256","name": "price","type": "uint256"}],"internalType": "struct MetalPriceData","name": "priceData","type": "tuple"}`;
console.log(`ABI Signature: ${abiSignature}\n`);

// --- FDC Configuration ---
const attestationTypeBase = "IJsonApi";
const sourceIdBase = "WEB2";
const verifierUrlBase = JQ_VERIFIER_URL_TESTNET;

// --- Script Execution ---

async function prepareAttestationRequest(apiUrl: string, postprocessJq: string, abiSignature: string) {
    console.log("Preparing JSON API Attestation Request...");
    const requestBody = {
        url: apiUrl,
        postprocessJq: postprocessJq,
        abi_signature: abiSignature,
    };

    const url = `${verifierUrlBase}JsonApi/prepareRequest`;
    const apiKey = JQ_VERIFIER_API_KEY!;

    if (!apiKey) {
        throw new Error("JQ_VERIFIER_API_KEY environment variable not set!");
    }
    if (!verifierUrlBase) {
        throw new Error("JQ_VERIFIER_URL_TESTNET environment variable not set!");
    }

    return await prepareAttestationRequestBase(url, apiKey, attestationTypeBase, sourceIdBase, requestBody);
}

async function retrieveDataAndProof(abiEncodedRequest: string, roundId: number) {
    console.log(`Retrieving Proof for round ${roundId}...`);
    const url = `${COSTON_DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
    if (!COSTON_DA_LAYER_URL) {
        throw new Error("COSTON_DA_LAYER_URL environment variable not set!");
    }
    console.log("DA Layer URL:", url, "\n");
    return await retrieveDataAndProofBase(url, abiEncodedRequest, roundId);
}

async function deployAndVerifyContract(symbol: string): Promise<{
    customFeed: MetalPriceVerifierCustomFeedInstance;
}> {
    console.log(`Deploying MetalPriceVerifierCustomFeed contract for ${symbol}...`);
    const feedIdString = `${symbol}/USD`; // e.g., "XAU/USD"
    const feedIdHex = toUtf8HexString(feedIdString).substring(2); // Remove '0x'
    // Truncate to 20 bytes (40 hex chars) and add 0x21 prefix (total 21 bytes / 42 hex chars + '0x')
    const truncatedFeedIdHex = feedIdHex.substring(0, 40);
    const finalFeedIdHex = `0x21${truncatedFeedIdHex}`; // Prepend '0x21'

    if (finalFeedIdHex.length !== 44) {
        throw new Error(
            `Generated feed ID has incorrect length: ${finalFeedIdHex.length}. Expected 44 characters (0x + 42 hex). Feed string: ${feedIdString}`
        );
    }
    console.log("Feed ID String:", feedIdString);
    console.log("Final Feed ID Hex (bytes21 with 0x21 prefix):", finalFeedIdHex);

    const customFeedArgs: any[] = [finalFeedIdHex, symbol]; // Pass bytes21 feedId and symbol string
    const customFeed: MetalPriceVerifierCustomFeedInstance = await MetalPriceVerifierCustomFeed.new(...customFeedArgs);
    console.log(`MetalPriceVerifierCustomFeed (${symbol}) deployed to:`, customFeed.address);

    await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds delay

    try {
        console.log("Attempting verification on block explorer...");
        await run("verify:verify", {
            address: customFeed.address,
            constructorArguments: customFeedArgs,
            contract: "contracts/customFeeds/MetalPriceVerifierCustomFeed.sol:MetalPriceVerifierCustomFeed", // Specify contract path
        });
        console.log("MetalPriceVerifierCustomFeed verified successfully.");
    } catch (e: any) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("MetalPriceVerifierCustomFeed already verified.");
        } else {
            console.error("MetalPriceVerifierCustomFeed verification failed:", e.message);
        }
    }
    console.log("");

    return { customFeed };
}

async function submitProofToCustomFeed(customFeed: MetalPriceVerifierCustomFeedInstance, proof: any) {
    console.log("Submitting proof to MetalPriceVerifierCustomFeed contract...");
    console.log("Raw Proof Data Hex (IJsonApi.Proof.data):", proof.response_hex, "\n");

    // Find the ABI definition for IJsonApi.Data struct from the artifacts
    const iJsonApiAbi = coston.interfaceAbis.IJsonApiVerification;
    const proofDataAbiDefinition = (iJsonApiAbi as any[]).find(
        (item: any) => item.name === "Data" && item.type === "tuple"
    );

    if (!proofDataAbiDefinition) {
        throw new Error("Could not find 'IJsonApi.Data' struct definition in ABI. Check contract artifacts.");
    }
    // console.log("Dynamically Determined ABI Definition for Proof 'data':", JSON.stringify(proofDataAbiDefinition, null, 2), "\n"); // Optional: Log ABI structure

    // Decode the 'response_hex' using the found ABI definition
    // Ensure ethers version compatibility for defaultAbiCoder
    const decodedProofData = ethers.utils.defaultAbiCoder.decode([proofDataAbiDefinition as any], proof.response_hex);
    console.log("Decoded Proof Data Struct (IJsonApi.Data):", JSON.stringify(decodedProofData, null, 2), "\n"); // Log decoded structure for verification

    // Construct the argument expected by the contract's verifyPrice function
    const contractProofArgument = {
        merkleProof: proof.proof,
        data: decodedProofData[0], // The actual decoded struct is the first element of the array
    };

    console.log(
        "Calling verifyPrice function on CustomFeed with structured proof argument:",
        JSON.stringify(
            contractProofArgument,
            (key, value) => (typeof value === "bigint" ? value.toString() : value), // Convert BigInts for logging
            2
        ),
        "\n"
    );

    // Call verifyPrice on the customFeed contract instance
    const transaction = await customFeed.verifyPrice(contractProofArgument);
    console.log("Transaction successful! TX Hash:", transaction.tx);
    console.log("Gas used:", transaction.receipt.gasUsed, "\n");

    // Check the stored price and timestamp directly from the custom feed contract
    // TODO: check timestamp
    const latestPrice = await customFeed.latestVerifiedPrice();
    const latestTimestamp = await customFeed.latestVerifiedTimestamp();
    const feedDecimals = await customFeed.decimals();

    console.log(
        `Latest verified price stored in MetalPriceVerifierCustomFeed (${metalSymbol}): ${latestPrice.toString()}`
    );
    console.log(`  Decimals: ${feedDecimals.toString()}`);
    console.log(`  Timestamp associated with the price: ${latestTimestamp.toString()} (Unix timestamp)`);
    console.log(`  Timestamp corresponds to: ${new Date(Number(latestTimestamp) * 1000).toUTCString()}`);
    console.log(
        `  Interpreted Price: $${(Number(latestPrice) / 10 ** Number(feedDecimals)).toFixed(Number(feedDecimals))}\n`
    );
}

async function interactWithCustomFeedContract(customFeed: MetalPriceVerifierCustomFeedInstance, symbol: string) {
    console.log(`Interacting with MetalPriceVerifierCustomFeed contract (${symbol})...`);

    const priceFromFeed = await customFeed.read();
    const feedDecimals = await customFeed.decimals();
    console.log(`Price read from Custom Feed contract via read() (${symbol}): ${priceFromFeed.toString()}`);
    console.log(`  Decimals: ${feedDecimals.toString()}`);
    console.log(
        `  Interpreted price from feed: $${(Number(priceFromFeed) / 10 ** Number(feedDecimals)).toFixed(Number(feedDecimals))}\n`
    );

    const feedIdResult = await customFeed.feedId();
    console.log(`  Feed ID (Hex): ${feedIdResult}\n`);

    console.log("Calling getFeedDataView() for off-chain reading:");
    const feedDataResult = await customFeed.getFeedDataView();
    const currentValue = feedDataResult[0];
    const currentDecimals = feedDataResult[1];
    console.log(`  Value: ${currentValue.toString()}`);
    console.log(`  Decimals: ${currentDecimals.toString()}`);

    console.log("Calling getCurrentFeed() for off-chain reading including timestamp:");
    const currentFeedResult = await customFeed.getCurrentFeed();
    const currentFeedValue = currentFeedResult[0];
    const currentFeedDecimals = currentFeedResult[1];
    const currentFeedTimestamp = currentFeedResult[2];
    console.log(`  Value: ${currentFeedValue.toString()}`);
    console.log(`  Decimals: ${currentFeedDecimals.toString()}`);
    console.log(
        `  Timestamp: ${currentFeedTimestamp.toString()} (${new Date(Number(currentFeedTimestamp) * 1000).toUTCString()})`
    );
}

async function main() {
    console.log(`--- Starting Metal Price Verification Script for ${metalSymbol}/USD ---`);

    // 1. Prepare the request for the FDC Verifier
    const preparedData = await prepareAttestationRequest(apiUrl, postprocessJq, abiSignature);
    console.log("Attestation Request Prepared:", preparedData, "\n");

    // 2. Submit the request to the FDC Hub on Flare network
    const abiEncodedRequest = preparedData.abiEncodedRequest;
    const roundId = await submitAttestationRequest(abiEncodedRequest);
    console.log(`Attestation Request Submitted. Waiting for round ${roundId} to finalize... Allow ~2-3 minutes.\n`);

    // 3. Retrieve the proof from the DA Layer after the round finalizes
    //    Increase timeout if rounds take longer
    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);
    console.log("Proof Retrieved Successfully.\n"); // Simplified log

    // Detailed check of proof structure
    if (!proof || !proof.proof || !Array.isArray(proof.proof) || proof.proof.length === 0) {
        console.error(
            "Retrieved proof structure is invalid or empty (merkleProof missing/empty). Proof:",
            JSON.stringify(proof, null, 2)
        );
        throw new Error("Failed to retrieve a valid proof structure from the DA Layer (merkleProof missing/empty).");
    }
    if (!proof.response_hex || typeof proof.response_hex !== "string" || !proof.response_hex.startsWith("0x")) {
        console.error(
            "Retrieved proof structure is invalid (response_hex missing or invalid). Proof:",
            JSON.stringify(proof, null, 2)
        );
        throw new Error(
            "Failed to retrieve a valid proof structure from the DA Layer (response_hex missing or invalid)."
        );
    }
    // console.log("Detailed Proof Structure:", JSON.stringify(proof, null, 2), "\n");

    // 4. Deploy the MetalPriceVerifierCustomFeed contract
    const { customFeed } = await deployAndVerifyContract(metalSymbol);

    // 5. Send the proof to the MetalPriceVerifierCustomFeed contract for verification and storage
    await submitProofToCustomFeed(customFeed, proof);

    // 6. Interact with the MetalPriceVerifierCustomFeed contract to read the price/feed data
    await interactWithCustomFeedContract(customFeed, metalSymbol);

    console.log(`--- Metal Price Verification Script (${metalSymbol}/USD) Finished ---`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
