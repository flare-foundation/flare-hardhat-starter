import { run, web3 } from "hardhat";
import { PriceVerifierCustomFeedInstance } from "../../typechain-types";
import {
    prepareAttestationRequestBase,
    submitAttestationRequest,
    retrieveDataAndProofBase,
    toUtf8HexString,
} from "../fdcExample/Base";
import { coston } from "@flarenetwork/flare-periphery-contract-artifacts";

const PriceVerifierCustomFeed = artifacts.require("PriceVerifierCustomFeed");

const { WEB2JSON_VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON_DA_LAYER_URL } = process.env;

const priceSymbol = "BTC";
const priceDecimals = 2;

const coinGeckoIds: { [key: string]: string } = {
    BTC: "bitcoin",
    ETH: "ethereum",
};
const coinGeckoId = coinGeckoIds[priceSymbol];
if (!coinGeckoId) {
    throw new Error(`CoinGecko ID not found for symbol: ${priceSymbol}`);
}

const dateToFetch = new Date();
dateToFetch.setDate(dateToFetch.getDate() - 2);

const day = String(dateToFetch.getDate()).padStart(2, "0");
const month = String(dateToFetch.getMonth() + 1).padStart(2, "0");
const year = dateToFetch.getFullYear();
const dateString = `${day}-${month}-${year}`;

const apiUrl = `https://api.coingecko.com/api/v3/coins/${coinGeckoId}/history?date=${dateString}&localization=false`;
console.log(`API URL: ${apiUrl}`);

const postprocessJq = `{price: (.market_data.current_price.usd * ${10 ** priceDecimals} | floor)}`;
console.log(`JQ Filter: ${postprocessJq}`);

const abiSignature = `{"components": [{"internalType": "uint256","name": "price","type": "uint256"}],"internalType": "struct PriceData","name": "priceData","type": "tuple"}`;
console.log(`ABI Signature: ${abiSignature}\n`);

const attestationTypeBase = "Web2Json";
const sourceIdBase = "PublicWeb2";
const verifierUrlBase = WEB2JSON_VERIFIER_URL_TESTNET;

async function prepareAttestationRequest(apiUrl: string, postprocessJq: string, abiSignature: string) {
    console.log("Preparing Web2Json Attestation Request...");
    const requestBody = {
        url: apiUrl,
        abiEncodeArgs: {
            postprocessJq: postprocessJq,
            abi_signature: abiSignature,
        },
    };

    const url = `${verifierUrlBase}Web2Json/prepareRequest`;
    const apiKey = VERIFIER_API_KEY_TESTNET!;

    if (!apiKey) {
        throw new Error("VERIFIER_API_KEY_TESTNET environment variable not set!");
    }
    if (!verifierUrlBase) {
        throw new Error("WEB2JSON_VERIFIER_URL_TESTNET environment variable not set!");
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

async function deployAndVerifyContract(): Promise<{
    customFeed: PriceVerifierCustomFeedInstance;
}> {
    console.log(`Deploying PriceVerifierCustomFeed contract for ${priceSymbol}...`);
    const feedIdString = `${priceSymbol}/USD-HIST`;
    const feedIdHex = toUtf8HexString(feedIdString).substring(2);
    const truncatedFeedIdHex = feedIdHex.substring(0, 40);
    const finalFeedIdHex = `0x21${truncatedFeedIdHex}`;

    if (finalFeedIdHex.length !== 44) {
        throw new Error(
            `Generated feed ID has incorrect length: ${finalFeedIdHex.length}. Expected 44 characters (0x + 42 hex). Feed string: ${feedIdString}`
        );
    }
    console.log("Final Feed ID Hex (bytes21 with 0x21 prefix):", finalFeedIdHex);

    const customFeedArgs: any[] = [finalFeedIdHex, priceSymbol, priceDecimals];
    const customFeed: PriceVerifierCustomFeedInstance = await PriceVerifierCustomFeed.new(...customFeedArgs);
    console.log(`PriceVerifierCustomFeed (${priceSymbol}) deployed to:`, customFeed.address);

    await new Promise(resolve => setTimeout(resolve, 15000));

    try {
        console.log("Attempting verification on block explorer...");
        await run("verify:verify", {
            address: customFeed.address,
            constructorArguments: customFeedArgs,
            contract: "contracts/customFeeds/PriceVerifierCustomFeed.sol:PriceVerifierCustomFeed",
        });
        console.log("PriceVerifierCustomFeed verified successfully.");
    } catch (e: any) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("PriceVerifierCustomFeed already verified.");
        } else {
            console.error("PriceVerifierCustomFeed verification failed:", e.message);
        }
    }
    console.log("\n");

    return { customFeed };
}

async function submitProofToCustomFeed(customFeed: PriceVerifierCustomFeedInstance, proof: any) {
    console.log("Submitting Web2Json proof to PriceVerifierCustomFeed contract...");
    console.log(
        "Raw Proof from DA (contains ABI encoded IWeb2JsonVerification.Data):",
        JSON.stringify(proof, null, 2),
        "\n"
    );

    const iWeb2JsonVerificationAbi = coston.interfaceAbis.IWeb2JsonVerification;
    const web2JsonDataAbiDefinition = (iWeb2JsonVerificationAbi as any[]).find(
        (item: any) => item.name === "Data" && item.type === "tuple"
    );
    if (!web2JsonDataAbiDefinition) {
        throw new Error("Could not find 'IWeb2JsonVerification.Data' struct definition in ABI.");
    }

    const decodedWeb2JsonData = web3.eth.abi.decodeParameter(web2JsonDataAbiDefinition as any, proof.data);
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
                const urlValue = event.args?.apiUrl;
                console.log(
                    `PriceVerified Event: Symbol: ${symbol}, Price: ${price ? price.toString() : "N/A"}, URL: ${urlValue}`
                );
                const storedPrice = await customFeed.latestVerifiedPrice();
                const storedDecimals = await customFeed.DECIMALS();
                console.log(
                    `Latest verified price from contract for ${symbol}: ${storedPrice.toString()} (Decimals: ${storedDecimals.toString()})`
                );
            }
        }
    }
    console.log("\n");
}

async function main() {
    const { customFeed } = await deployAndVerifyContract();

    console.log("--- Step 1: Prepare Attestation Request ---");
    const preparedRequest = await prepareAttestationRequest(apiUrl, postprocessJq, abiSignature);
    const abiEncodedRequest = preparedRequest.abiEncodedRequest;
    console.log("ABI Encoded Request:", abiEncodedRequest, "\n");

    console.log("--- Step 2: Submit Attestation Request ---");
    const roundId = await submitAttestationRequest(abiEncodedRequest);
    if (roundId === -1) {
        console.error("Failed to submit attestation request or retrieve round ID.");
        return;
    }
    console.log(`Attestation request submitted. Round ID: ${roundId}\n`);

    console.log("Waiting for 20 seconds for proof generation...");
    await new Promise(resolve => setTimeout(resolve, 20000));

    console.log("--- Step 3: Retrieve Data and Proof ---");
    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);
    if (!proof || !proof.data || !proof.merkleProof) {
        console.error("Failed to retrieve valid proof from DA layer.");
        console.log("Retrieved proof object:", JSON.stringify(proof, null, 2));
        return;
    }
    console.log("Proof retrieved successfully from DA layer.\n");

    console.log("--- Step 4: Submit Proof to Custom Feed Contract ---");
    await submitProofToCustomFeed(customFeed, proof);

    console.log(`Price Verification script for ${priceSymbol} completed.`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
