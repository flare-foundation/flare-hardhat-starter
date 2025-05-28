import { run, web3, artifacts } from "hardhat";
import { InflationCustomFeedInstance } from "../../typechain-types";
import {
    prepareAttestationRequestBase,
    submitAttestationRequest,
    retrieveDataAndProofBase,
    toUtf8HexString,
} from "../fdcExample/Base"

const { WEB2JSON_VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON_DA_LAYER_URL } = process.env;

const inflationDatasetIdentifier = "US_INFLATION_CPI_ANNUAL";

const currentYear = new Date().getFullYear();
const targetYear = (currentYear - 2).toString();

const INDICATOR_CODE = "FP.CPI.TOTL.ZG"; // Consumer Price Index, annual % change
const apiUrl = `https://api.worldbank.org/v2/country/US/indicator/${INDICATOR_CODE}?format=json&date=${targetYear}`;

const postprocessJq = `{inflationRate: (.[1][0].value | tonumber * 1000000 | floor), observationYear: (.[1][0].date | tonumber)}`;
const abiSignature = `{"components": [{"internalType": "uint256","name": "inflationRate","type": "uint256"}, {"internalType": "uint256","name": "observationYear","type": "uint256"}],"internalType": "struct InflationData","name": "inflationData","type": "tuple"}`;

const attestationTypeBase = "Web2Json";
const sourceIdBase = "PublicWeb2";
const verifierUrlBase = WEB2JSON_VERIFIER_URL_TESTNET;
const CustomFeedContract = artifacts.require("InflationCustomFeed");
/**
 * Prepares the attestation request for the Web2Json FDC Verifier.
 */
async function prepareAttestationRequest(apiUrl: string, postprocessJqString: string, abiSignatureString: string) {
    console.log("Preparing Web2Json Attestation Request for Inflation data...");

    if (!verifierUrlBase) {
        throw new Error("WEB2JSON_VERIFIER_URL_TESTNET environment variable not set!");
    }
    if (!VERIFIER_API_KEY_TESTNET) {
        throw new Error("VERIFIER_API_KEY_TESTNET environment variable not set!");
    }

    const requestBody = {
        url: apiUrl,
        httpMethod: "GET",
        headers: "{}",
        queryParams: "{}",
        body: "{}",
        postprocessJq: postprocessJqString,
        abiSignature: abiSignatureString,
    };

    const verifierPrepareUrl = `${verifierUrlBase}/Web2Json/prepareRequest`;
    const apiKey = VERIFIER_API_KEY_TESTNET!;

    return await prepareAttestationRequestBase(
        verifierPrepareUrl,
        apiKey,
        attestationTypeBase,
        sourceIdBase,
        requestBody
    );
}

async function retrieveDataAndProof(abiEncodedRequest: string, roundId: number) {
    console.log(`Retrieving Proof for round ${roundId}...`);

    if (!COSTON_DA_LAYER_URL) {
        throw new Error("COSTON_DA_LAYER_URL environment variable not set!");
    }
    const daLayerUrl = `${COSTON_DA_LAYER_URL}/api/v1/fdc/proof-by-request-round-raw`;
    console.log("DA Layer URL:", daLayerUrl);

    return await retrieveDataAndProofBase(daLayerUrl, abiEncodedRequest, roundId);
}

async function deployAndVerifyContract(name: string): Promise<{
    customFeed: InflationCustomFeedInstance;
}> {
    console.log(`Deploying CustomFeed contract for ${name}...`);

    const feedIdStringComposite = `INFLATION/${name}`;
    const feedIdHexRaw = toUtf8HexString(feedIdStringComposite).substring(2);
    const truncatedFeedIdHexContent = feedIdHexRaw.substring(0, 40);
    const finalFeedIdBytes21 = `0x21${truncatedFeedIdHexContent}`;

    if (finalFeedIdBytes21.length !== 44) {
        throw new Error(
            `Generated feed ID has incorrect length: ${finalFeedIdBytes21.length}. Expected 44. Input string for hashing: ${feedIdStringComposite}`
        );
    }
    console.log("Feed ID String (used for internal hashing in contract):", feedIdStringComposite);
    console.log("Final Feed ID (bytes21) for constructor:", finalFeedIdBytes21);

    const customFeedArgs: any[] = [finalFeedIdBytes21, name];

    const customFeed: InflationCustomFeedInstance = await CustomFeedContract.new(...customFeedArgs);
    console.log(`CustomFeed (${name}) deployed to:`, customFeed.address);

    console.log("Waiting 20 seconds before attempting verification...");
    await new Promise(resolve => setTimeout(resolve, 20000));

    try {
        console.log("Attempting verification on block explorer...");
        await run("verify:verify", {
            address: customFeed.address,
            constructorArguments: customFeedArgs,
            contract: "contracts/customFeeds/InflationCustomFeed.sol:InflationCustomFeed",
        });
        console.log("CustomFeed verified successfully.");
    } catch (e: any) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("CustomFeed already verified.");
        } else {
            console.error("CustomFeed verification failed:", e.message);
        }
    }
    console.log("");
    return { customFeed };
}
async function submitProofToCustomFeed(customFeed: InflationCustomFeedInstance, proofFromDALayer: any) {
    console.log("Submitting proof to CustomFeed contract for inflation data (expecting Web2Json proof structure)...");

    if (!proofFromDALayer || !proofFromDALayer.response_hex || !proofFromDALayer.proof) {
        if (proofFromDALayer && proofFromDALayer.status) {
            // Check if DA Layer returned an error status
            console.error(
                "DA Layer returned an error status in proof object:",
                proofFromDALayer.status,
                proofFromDALayer.message || ""
            );
        }
        throw new Error(
            "Invalid proof structure from DA Layer (missing response_hex or proof). Full proof object: " +
                JSON.stringify(proofFromDALayer)
        );
    }

    let web2JsonDataAbiDefinition: any;
    try {
        const IWeb2JsonVerification = await artifacts.require("IWeb2JsonVerification");
        const verifyProofFunctionAbi = IWeb2JsonVerification.abi.find(
            (item: any) => item.name === "verifyProof" && item.type === "function"
        );

        if (
            verifyProofFunctionAbi &&
            verifyProofFunctionAbi.inputs &&
            verifyProofFunctionAbi.inputs.length > 0 &&
            verifyProofFunctionAbi.inputs[0].type === "tuple" && // _proof is a tuple (ProofStruct)
            verifyProofFunctionAbi.inputs[0].components
        ) {
            // Find the 'data' component within ProofStruct
            web2JsonDataAbiDefinition = verifyProofFunctionAbi.inputs[0].components.find(
                (comp: any) => comp.name === "data" && comp.type === "tuple" // data is also a tuple (Data struct)
            );
        }
        if (!web2JsonDataAbiDefinition) {
            console.error("Detailed IWeb2JsonVerification ABI:", JSON.stringify(IWeb2JsonVerification.abi, null, 2));
            throw new Error(
                "Could not find IWeb2JsonVerification.Data ABI definition within verifyProof function parameters."
            );
        }
    } catch (e) {
        console.error("Error loading IWeb2JsonVerification artifact or finding Data ABI:", e);
        throw new Error(
            "Failed to load IWeb2JsonVerification artifact or derive Data ABI. Ensure '@flarenetwork/flare-periphery-contract-artifacts' is correctly installed and contract is compiled."
        );
    }

    const decodedWeb2JsonData = web3.eth.abi.decodeParameter(
        web2JsonDataAbiDefinition,
        proofFromDALayer.response_hex
    );
    console.log(
        "Decoded IWeb2JsonVerification.Data:",
        JSON.stringify(decodedWeb2JsonData, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2)
    );

    const actualAbiEncodedDataPayload = decodedWeb2JsonData.response_body_abi_encoded;
    if (!actualAbiEncodedDataPayload || !actualAbiEncodedDataPayload.startsWith("0x")) {
        throw new Error(
            `'response_body_abi_encoded' is missing or invalid in decoded Web2Json Data. Value: ${actualAbiEncodedDataPayload}`
        );
    }

    const inflationDataAbiType = JSON.parse(abiSignature);
    try {
        const decodedDataForCheck = web3.eth.abi.decodeParameter(
            inflationDataAbiType,
            actualAbiEncodedDataPayload
        );

        if (decodedDataForCheck.inflationRate === undefined || decodedDataForCheck.observationYear === undefined) {
            console.warn(
                `No valid inflation data found in Web2Json proof's payload for ${targetYear}. Decoded:`,
                JSON.stringify(decodedDataForCheck, null, 2)
            );
            throw new Error(`No valid inflation data for ${targetYear} in payload. Cannot submit proof.`);
        }
        console.log(
            "Decoded data for pre-submission check (actual payload from Web2Json proof):",
            JSON.stringify(decodedDataForCheck, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2)
        );
    } catch (decodeError) {
        console.error("Error decoding actual data payload (inflation data) from Web2Json proof:", decodeError);
        console.error("Problematic actualAbiEncodedDataPayload:", actualAbiEncodedDataPayload);
        console.error("ABI Signature used for this specific payload:", abiSignature);
        throw new Error("Failed to decode actual data payload (inflation data) from Web2Json proof.");
    }
    const contractProofArgument = {
        merkleProof: proofFromDALayer.proof,
        data: decodedWeb2JsonData,
    };

    console.log("Calling verifyInflationData function on CustomFeed (expecting IWeb2JsonVerification.ProofStruct)...");
    const transaction = await customFeed.verifyInflationData(contractProofArgument);
    console.log("Transaction successful! TX Hash:", transaction.tx);
    console.log("Gas used:", transaction.receipt.gasUsed);

    const latestInflationDataResult = await customFeed.latestInflationData();
    const latestVerificationTs = await customFeed.latestVerifiedTimestamp();

    console.log(
        `\nLatest verified Inflation Rate stored in CustomFeed (${inflationDatasetIdentifier}): ${latestInflationDataResult.inflationRate.toString()}`
    );
    console.log(
        `  (Interpretation: Scaled by 1,000,000. Contract decimals() is ${await customFeed.decimals()}, so this is the raw value from contract)`
    );
    console.log(`  Observation Year associated with the data: ${latestInflationDataResult.observationYear.toString()}`);
    console.log(
        `  Data verified on-chain at (timestamp from contract): ${latestVerificationTs.toString()} (${Number(latestVerificationTs) > 0 ? new Date(Number(latestVerificationTs) * 1000).toUTCString() : "Timestamp not set or 0"})`
    );
    console.log("");
}

async function interactWithCustomFeedContract(customFeed: InflationCustomFeedInstance, datasetId: string) {
    console.log(`Interacting with CustomFeed contract (${datasetId})...`);

    const feedIdResult = await customFeed.feedId();
    console.log(`  Feed ID from contract (Hex): ${feedIdResult}`);

    const decimalsResult = await customFeed.decimals();
    console.log(`  Decimals from contract: ${decimalsResult.toString()}`);

    console.log("\nCalling getCurrentFeed() for off-chain reading (example):");
    const currentFeedResult = await customFeed.getCurrentFeed();
    const currentInflation = currentFeedResult[0];
    const currentDecimals = currentFeedResult[1];
    const currentTimestampOrYear = currentFeedResult[2];

    console.log(`  Current Inflation Rate (from getCurrentFeed): ${currentInflation.toString()}`);
    console.log(`  Decimals (from getCurrentFeed): ${currentDecimals.toString()}`);
    console.log(
        `  Timestamp/Year (from getCurrentFeed, i.e., latestVerifiedTimestamp): ${currentTimestampOrYear.toString()}`
    );
    console.log("");
}

function validateProofFromDALayer(proofFromDALayer: any) {
    if (
        !proofFromDALayer ||
        typeof proofFromDALayer.response_hex !== "string" ||
        !proofFromDALayer.response_hex.startsWith("0x") ||
        !Array.isArray(proofFromDALayer.proof)
    ) {
        console.error(
            "Retrieved proof structure is invalid ('response_hex' missing/invalid or 'proof' missing/not an array). Proof:",
            JSON.stringify(proofFromDALayer, null, 2)
        );
        throw new Error("Failed to retrieve a valid proof structure from DA Layer.");
    }
}

async function main() {
    console.log(
        `--- Starting Inflation Data Verification Script for ${inflationDatasetIdentifier} (using Web2Json) ---`
    );
    console.log(`Fetching data for: ${inflationDatasetIdentifier}`);
    console.log(`Targeting inflation data for year: ${targetYear}`);
    console.log(`API URL: ${apiUrl}`);
    console.log(`JQ Filter to be sent: ${postprocessJq}`);
    console.log(`ABI Signature for data payload: ${abiSignature}\n`);

    const preparedData = await prepareAttestationRequest(apiUrl, postprocessJq, abiSignature);
    console.log("Attestation Request Prepared. ABI Encoded Request:", preparedData.abiEncodedRequest, "\n");

    const abiEncodedRequest = preparedData.abiEncodedRequest;
    const roundId = await submitAttestationRequest(abiEncodedRequest);
    console.log(`Attestation Request Submitted. Waiting for round ${roundId} to finalize... Allow ~2-3 minutes.\n`);

    const proofFromDALayer = await retrieveDataAndProof(abiEncodedRequest, roundId);
    console.log("Proof Retrieved Successfully from DA Layer.\n");

    validateProofFromDALayer(proofFromDALayer);

    const { customFeed } = await deployAndVerifyContract(inflationDatasetIdentifier);

    await submitProofToCustomFeed(customFeed, proofFromDALayer);
    await interactWithCustomFeedContract(customFeed, inflationDatasetIdentifier);

    console.log(`--- Inflation Data Verification Script (${inflationDatasetIdentifier}) Finished Successfully ---`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("\n--- SCRIPT FAILED ---");
        console.error(error);
        process.exit(1);
    });
