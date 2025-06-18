import { run, web3 } from "hardhat";
import { MetalPriceVerifierCustomFeedInstance } from "../../typechain-types";
import {
    prepareAttestationRequestBase,
    submitAttestationRequest,
    retrieveDataAndProofBase,
    toUtf8HexString,
} from "../fdcExample/Base";
import { coston2 } from "@flarenetwork/flare-periphery-contract-artifacts";

const MetalPriceVerifierCustomFeed = artifacts.require("MetalPriceVerifierCustomFeed");

const { WEB2JSON_VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL, METAL_SYMBOL } = process.env;

interface AttestationRequest {
    source: string;
    sourceIdBase: string;
    verifierUrlBase: string;
    verifierApiKey: string;
    urlTypeBase: string;
    data: any;
}

const metalSymbol = METAL_SYMBOL || "XAU";
const supportedMetals = ["XAU", "XAG", "XPT"];
if (!supportedMetals.includes(metalSymbol)) {
    throw new Error(`Unsupported METAL_SYMBOL: ${metalSymbol}. Must be one of ${supportedMetals.join(", ")}`);
}
console.log(`Fetching price for: ${metalSymbol}/USD`);

const apiUrl = `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${metalSymbol}/USD`;
console.log(`API URL: ${apiUrl}`);

const postprocessJq = `{price: (.[0].spreadProfilePrices[0].ask * 10000 | floor)}`;
console.log(`JQ Filter: ${postprocessJq}`);

const abiSignature = `{"components": [{"internalType": "uint256","name": "price","type": "uint256"}],"internalType": "struct MetalPriceData","name": "priceData","type": "tuple"}`;
console.log(`ABI Signature: ${abiSignature}\n`);

const globalSourceIdBase = "PublicWeb2";

async function prepareAttestationRequest(config: AttestationRequest) {
    console.log("Preparing Web2Json Attestation Request...");

    if (!config.verifierApiKey) {
        throw new Error("Verifier API Key (verifierApiKey) not set in config!");
    }
    if (!config.verifierUrlBase) {
        throw new Error("Verifier URL (verifierUrlBase) not set in config!");
    }
    const web2JsonData = config.data as {
        apiUrl: string;
        httpMethod: string;
        headers: string;
        queryParams: string;
        body: string;
        postProcessJq: string;
        abiSignature: string;
    };

    const requestBody = {
        url: web2JsonData.apiUrl,
        httpMethod: web2JsonData.httpMethod,
        headers: web2JsonData.headers,
        queryParams: web2JsonData.queryParams,
        body: web2JsonData.body,
        postProcessJq: web2JsonData.postProcessJq,
        abiSignature: web2JsonData.abiSignature,
    };

    const attestationTypeBase = "Web2Json";
    const verifierPrepareUrl = `${config.verifierUrlBase}Web2Json/prepareRequest`;
    
    return await prepareAttestationRequestBase(
        verifierPrepareUrl,
        config.verifierApiKey,
        attestationTypeBase,
        config.sourceIdBase,
        requestBody
    );
}

async function retrieveDataAndProof(abiEncodedRequest: string, roundId: number) {
    console.log(`Retrieving Proof for round ${roundId}...`);
    const url = `${COSTON2_DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
    if (!COSTON2_DA_LAYER_URL) {
        throw new Error("COSTON2_DA_LAYER_URL environment variable not set!");
    }
    console.log("DA Layer URL:", url, "\n");
    return await retrieveDataAndProofBase(url, abiEncodedRequest, roundId);
}

async function deployAndVerifyContract(symbol: string): Promise<{
    customFeed: MetalPriceVerifierCustomFeedInstance;
}> {
    console.log(`Deploying MetalPriceVerifierCustomFeed contract for ${symbol}...`);
    const feedIdString = `${symbol}/USD`;
    const feedIdHex = toUtf8HexString(feedIdString).substring(2);
    const truncatedFeedIdHex = feedIdHex.substring(0, 40);
    const finalFeedIdHex = `0x21${truncatedFeedIdHex}`;

    if (finalFeedIdHex.length !== 44) {
        throw new Error(
            `Generated feed ID has incorrect length: ${finalFeedIdHex.length}. Expected 44 characters (0x + 42 hex). Feed string: ${feedIdString}`
        );
    }
    console.log("Feed ID String:", feedIdString);
    console.log("Final Feed ID Hex (bytes21 with 0x21 prefix):", finalFeedIdHex);

    const customFeedArgs: any[] = [finalFeedIdHex, symbol];
    const customFeed: MetalPriceVerifierCustomFeedInstance = await MetalPriceVerifierCustomFeed.new(...customFeedArgs);
    console.log(`MetalPriceVerifierCustomFeed (${symbol}) deployed to:`, customFeed.address);

    await new Promise(resolve => setTimeout(resolve, 15000));

    try {
        console.log("Attempting verification on block explorer...");
        await run("verify:verify", {
            address: customFeed.address,
            constructorArguments: customFeedArgs,
            contract: "contracts/customFeeds/MetalPriceVerifierCustomFeed.sol:MetalPriceVerifierCustomFeed",
        });
        console.log("MetalPriceVerifierCustomFeed verified successfully.");
    } catch (e: any) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("MetalPriceVerifierCustomFeed already verified.");
        } else {
            console.error("MetalPriceVerifierCustomFeed verification failed:", e.message);
        }
    }
    console.log("\n");

    return { customFeed };
}

async function submitProofToCustomFeed(customFeed: MetalPriceVerifierCustomFeedInstance, proof: any) {
    console.log("Submitting Web2Json proof to MetalPriceVerifierCustomFeed contract...");
    console.log(
        "Raw Proof from DA (contains ABI encoded IWeb2JsonVerification.Data):",
        JSON.stringify(proof, null, 2),
        "\n"
    );

    const iWeb2JsonVerificationAbi = coston2.interfaceAbis.IWeb2JsonVerification;
    const web2JsonDataAbiDefinition = (iWeb2JsonVerificationAbi as any[]).find(
        (item: any) => item.name === "Data" && item.type === "tuple"
    );
    if (!web2JsonDataAbiDefinition) {
        throw new Error(
            "Could not find 'IWeb2JsonVerification.Data' struct definition in ABI. Check contract artifacts."
        );
    }

    const decodedWeb2JsonData = web3.eth.abi.decodeParameter(web2JsonDataAbiDefinition, proof.data);
    console.log("Decoded IWeb2JsonVerification.Data:", JSON.stringify(decodedWeb2JsonData, null, 2), "\n");

    const contractProofArgument = {
        merkleProof: proof.merkleProof,
        data: decodedWeb2JsonData,
    };

    console.log(
        "Calling verifyPrice function on CustomFeed with IWeb2Json.Proof argument:",
        JSON.stringify(
            contractProofArgument,
            (key, value) => (typeof value === "bigint" ? value.toString() : value),
            2
        ),
        "\n"
    );

    const tx = await customFeed.verifyPrice(contractProofArgument);
    const receipt = await tx.wait();
    console.log("Proof submitted successfully. Transaction hash:", receipt.transactionHash);

    if (receipt.events) {
        for (const event of receipt.events) {
            console.log(`Event ${event.event} emitted with args:`, event.args);
            if (event.event === "PriceVerified") {
                const price = event.args?.price;
                const symbol = event.args?.symbol;
                const url = event.args?.apiUrl;
                console.log(
                    `PriceVerified Event: Symbol: ${symbol}, Price: ${price ? price.toString() : "N/A"}, URL: ${url}`
                );
                const storedPrice = await customFeed.latestVerifiedPrice();
                console.log(`Latest verified price from contract for ${symbol}: ${storedPrice.toString()}`);
            }
        }
    }
    console.log("\n");
}

function validateRetrievedMetalProof(proof: any) {
    if (!proof || !proof.data || !proof.merkleProof) {
        console.error("Failed to retrieve valid proof from DA layer.");
        console.log("Retrieved proof object:", JSON.stringify(proof, null, 2));
        throw new Error("Invalid proof structure retrieved from DA layer.");
    }
}

async function main() {
    const { customFeed } = await deployAndVerifyContract(metalSymbol);

    console.log("--- Step 1: Prepare Attestation Request ---");
    const metalPriceRequestConfig: AttestationRequest = {
        source: "web2json",
        sourceIdBase: globalSourceIdBase,
        verifierUrlBase: WEB2JSON_VERIFIER_URL_TESTNET!,
        verifierApiKey: VERIFIER_API_KEY_TESTNET!,
        urlTypeBase: "",
        data: {
            apiUrl: apiUrl,
            httpMethod: "GET",
            headers: "{}",
            queryParams: "{}",
            body: "{}",
            postProcessJq: postprocessJq,
            abiSignature: abiSignature,
        },
    };

    const preparedRequest = await prepareAttestationRequest(metalPriceRequestConfig);
    const abiEncodedRequest = preparedRequest.abiEncodedRequest;
    console.log("ABI Encoded Request:", abiEncodedRequest, "\n");

    console.log("--- Step 2: Submit Attestation Request ---");
    const roundId = await submitAttestationRequest(abiEncodedRequest);
    if (roundId === -1) {
        console.error("Failed to submit attestation request or retrieve round ID.");
        return;
    }
    console.log(`Attestation request submitted. Round ID: ${roundId}\n`);

    await new Promise(resolve => setTimeout(resolve, 20000));

    console.log("--- Step 3: Retrieve Data and Proof ---");
    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);
    validateRetrievedMetalProof(proof);
    console.log("Proof retrieved successfully from DA layer.\n");

    console.log("--- Step 4: Submit Proof to Custom Feed Contract ---");
    await submitProofToCustomFeed(customFeed, proof);

    console.log("Metal Price Verification script completed.");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
