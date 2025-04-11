import { run, web3 } from "hardhat";
import {
  PriceVerifierInstance,
  PriceVerifierCustomFeedInstance,
} from "../../typechain-types";
import {
  prepareAttestationRequestBase,
  submitAttestationRequest,
  retrieveDataAndProofBase,
} from "./Base";

// Import the contract artifacts
const PriceVerifier = artifacts.require("PriceVerifier");
const PriceVerifierCustomFeed = artifacts.require("PriceVerifierCustomFeed");

const {
  JQ_VERIFIER_URL_TESTNET, // e.g., https://verifier-api.coston2.flare.network/
  JQ_VERIFIER_API_KEY_TESTNET, // Your API key for the JQ Verifier
  COSTON2_DA_LAYER_URL, // e.g., https://dalayer-api.coston2.flare.network/
} = process.env;
// --- Request Configuration ---

// 1. API Endpoint to fetch Bitcoin's historical price in USD for a specific timestamp from CryptoCompare
const timestamp = 1672531200; // Unix timestamp for Jan 1st, 2023 00:00:00 GMT
const cryptoCompareApiKey = process.env.CRYPTOCOMPARE_API_KEY; // Add this to your .env if needed

// Construct the URL - Add API key if required by CryptoCompare tier
const apiUrl = `https://min-api.cryptocompare.com/data/pricehistorical?fsym=BTC&tsyms=USD&ts=${timestamp}${
  cryptoCompareApiKey ? `&api_key=${cryptoCompareApiKey}` : ""
}`;

// 2. JQ Filter to extract the historical price and format it as cents
// IMPORTANT: Verify the actual response structure from CryptoCompare and adjust this filter!
// Input (example guess): {"BTC":{"USD":16604.44}}
// Output: {"price": 1660444} (multiplies by 100 and takes floor)
const postprocessJq = `{price: (.BTC.USD * 100 | floor)}`;

// 3. ABI Signature matching the PriceData struct in Solidity
const abiSignature = `{\"components\": [{\"internalType\": \"uint256\", \"name\": \"price\", \"type\": \"uint256\"}],\"name\": \"priceData\",\"type\": \"tuple\"}`;

// --- FDC Configuration ---
const attestationTypeBase = "IJsonApi"; // Attestation type for JSON API
const sourceIdBase = "WEB2"; // Source ID for generic Web2 APIs (CoinGecko)
const verifierUrlBase = JQ_VERIFIER_URL_TESTNET; // URL of the JQ Verifier service

// --- Script Execution ---

async function prepareAttestationRequest(
  apiUrl: string,
  postprocessJq: string,
  abiSignature: string
) {
  console.log("Preparing JSON API Attestation Request...");
  const requestBody = {
    url: apiUrl,
    postprocessJq: postprocessJq,
    abi_signature: abiSignature,
  };

  const url = `${verifierUrlBase}JsonApi/prepareRequest`;
  const apiKey = JQ_VERIFIER_API_KEY_TESTNET!;

  if (!apiKey) {
    throw new Error(
      "JQ_VERIFIER_API_KEY_TESTNET environment variable not set!"
    );
  }
  if (!verifierUrlBase) {
    throw new Error("JQ_VERIFIER_URL_TESTNET environment variable not set!");
  }

  return await prepareAttestationRequestBase(
    url,
    apiKey,
    attestationTypeBase,
    sourceIdBase,
    requestBody
  );
}

async function retrieveDataAndProof(
  abiEncodedRequest: string,
  roundId: number
) {
  console.log(`Retrieving Proof for round ${roundId}...`);
  const url = `${COSTON2_DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
  if (!COSTON2_DA_LAYER_URL) {
    throw new Error("COSTON2_DA_LAYER_URL environment variable not set!");
  }
  console.log("DA Layer URL:", url, "\n");
  return await retrieveDataAndProofBase(url, abiEncodedRequest, roundId);
}

// Deploy both PriceVerifier and PriceVerifierCustomFeed
async function deployAndVerifyContracts(): Promise<{
  priceVerifier: PriceVerifierInstance;
  customFeed: PriceVerifierCustomFeedInstance;
}> {
  console.log("Deploying PriceVerifier contract...");
  const priceVerifierArgs: any[] = []; // Constructor arguments for PriceVerifier
  const priceVerifier: PriceVerifierInstance = await PriceVerifier.new(
    ...priceVerifierArgs
  );
  console.log("PriceVerifier deployed to:", priceVerifier.address);

  // Optional: Verify PriceVerifier on block explorer
  try {
    await run("verify:verify", {
      address: priceVerifier.address,
      constructorArguments: priceVerifierArgs,
    });
    console.log("PriceVerifier verified successfully.");
  } catch (e: any) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("PriceVerifier already verified.");
    } else {
      console.error("PriceVerifier verification failed:", e);
    }
  }
  console.log("");

  console.log("Deploying PriceVerifierCustomFeed contract...");
  // Convert the string to hex and manually pad to bytes21 (42 hex chars + 0x prefix)
  const feedIdString = "BTC/USD-HIST";
  const feedIdHex = web3.utils.utf8ToHex(feedIdString).padEnd(44, "0"); // 42 chars + '0x' = 44
  const customFeedArgs: any[] = [priceVerifier.address, feedIdHex]; // Pass PriceVerifier address and the correctly padded bytes21 feed ID
  const customFeed: PriceVerifierCustomFeedInstance =
    await PriceVerifierCustomFeed.new(...customFeedArgs);
  console.log("PriceVerifierCustomFeed deployed to:", customFeed.address);

  // Verify PriceVerifierCustomFeed on block explorer
  try {
    await run("verify:verify", {
      address: customFeed.address,
      constructorArguments: customFeedArgs,
    });
    console.log("PriceVerifierCustomFeed verified successfully.");
  } catch (e: any) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("PriceVerifierCustomFeed already verified.");
    } else {
      console.error("PriceVerifierCustomFeed verification failed:", e);
    }
  }
  console.log("");

  return { priceVerifier, customFeed };
}

async function interactWithVerifierContract(
  priceVerifier: PriceVerifierInstance,
  proof: any // Consider defining a more specific interface if the structure is stable
) {
  console.log("Interacting with PriceVerifier contract...");
  // proof.response_hex contains the ABI-encoded 'data' part of the IJsonApi.Proof struct
  console.log(
    "Raw Proof Data Hex (IJsonApi.Proof.data):",
    proof.response_hex,
    "\n"
  );

  // --- Dynamically determine the ABI structure for decoding the proof data ---
  // To ensure we decode proof.response_hex correctly according to the exact
  // structure expected by the `verifyJsonApi` function on-chain, we dynamically
  // retrieve the ABI definition of that function's input parameter from the
  // verification contract's artifact. This avoids hardcoding the structure,
  // making the script more resilient to potential updates in the Flare contracts.
  const IJsonApiVerification = await artifacts.require("IJsonApiVerification");
  const verifyJsonApiAbi = IJsonApiVerification._json.abi.find(
    (item) => item.name === "verifyJsonApi" && item.type === "function" // Ensure it's the function ABI
  );

  if (
    !verifyJsonApiAbi ||
    !verifyJsonApiAbi.inputs ||
    verifyJsonApiAbi.inputs.length === 0
  ) {
    throw new Error(
      "Could not find 'verifyJsonApi(IJsonApi.Proof)' function definition in IJsonApiVerification ABI. Check contract artifacts."
    );
  }

  // The function expects a single argument of type IJsonApi.Proof (which is a struct/tuple)
  const proofInputDefinition = verifyJsonApiAbi.inputs[0];
  if (
    !proofInputDefinition ||
    proofInputDefinition.type !== "tuple" || // It must be a struct
    !proofInputDefinition.components // It must have components
  ) {
    throw new Error(
      "Expected 'verifyJsonApi' input to be a tuple (struct IJsonApi.Proof) in IJsonApiVerification ABI. ABI structure might have changed."
    );
  }

  // We need the specific ABI definition of the 'data' component within the IJsonApi.Proof struct,
  // as proof.response_hex corresponds to this part.
  const proofDataAbiDefinition = proofInputDefinition.components.find(
    (comp) => comp.name === "data"
  );
  if (!proofDataAbiDefinition) {
    throw new Error(
      "Could not find 'data' component definition within IJsonApi.Proof struct in IJsonApiVerification ABI. ABI structure might have changed."
    );
  }
  // --- End of dynamic ABI structure determination ---

  console.log(
    "Dynamically Determined ABI Definition for Proof 'data':",
    JSON.stringify(proofDataAbiDefinition, null, 2),
    "\n"
  );

  // Decode the raw hex data using the dynamically obtained ABI definition for the 'data' struct component
  const decodedProofData = web3.eth.abi.decodeParameter(
    proofDataAbiDefinition, // Use the dynamically found type definition for 'data'
    proof.response_hex // The raw hex data to decode
  );

  console.log("Decoded Proof Data:", decodedProofData, "\n");

  // Prepare the full proof structure for the contract call, matching the IJsonApi.Proof struct expected by verifyJsonApi
  // The contract function `verifyPrice` likely takes this structure as input.
  const contractProofArgument = {
    merkleProof: proof.proof, // The Merkle proof part from the DA layer response
    data: decodedProofData, // The decoded 'data' part
  };

  console.log(
    "Calling verifyPrice function with structured proof argument:",
    contractProofArgument,
    "\n"
  );
  const transaction = await priceVerifier.verifyPrice(contractProofArgument);
  console.log("Transaction successful! TX Hash:", transaction.tx);
  console.log("Gas used:", transaction.receipt.gasUsed, "\n");

  // Check the stored price
  const latestPrice = await priceVerifier.getLatestPrice();
  console.log(
    `Latest verified price stored in PriceVerifier (USD cents): ${latestPrice.toString()}`
  );
  console.log(`Which is $${(Number(latestPrice) / 100).toFixed(4)}\n`);
}

// New function to interact with the Custom Feed contract
async function interactWithCustomFeedContract(
  customFeed: PriceVerifierCustomFeedInstance
) {
  console.log("Interacting with PriceVerifierCustomFeed contract...");

  // Call the read() function (simulating FTSO system call)
  const priceFromFeed = await customFeed.read();
  console.log(
    `Price read from Custom Feed contract via read() (USD cents): ${priceFromFeed.toString()}`
  );

  // Call the decimals() helper function
  const feedDecimals = await customFeed.decimals();
  console.log(
    `Decimals reported by Custom Feed contract: ${feedDecimals.toString()}`
  );

  console.log(
    `Interpreted price from feed: $${(
      Number(priceFromFeed) /
      10 ** Number(feedDecimals)
    ).toFixed(4)}\n`
  );
}

async function main() {
  console.log("--- Starting Price Verification Script ---");

  // 1. Prepare the request for the FDC Verifier
  const preparedData = await prepareAttestationRequest(
    apiUrl,
    postprocessJq,
    abiSignature
  );
  console.log("Attestation Request Prepared:", preparedData, "\n");

  // 2. Submit the request to the FDC Hub on Flare network
  const abiEncodedRequest = preparedData.abiEncodedRequest;
  const roundId = await submitAttestationRequest(abiEncodedRequest);
  console.log(
    `Attestation Request Submitted. Waiting for round ${roundId} to finalize...\n`
  );

  // 3. Retrieve the proof from the DA Layer after the round finalizes
  // Note: retrieveDataAndProofBase includes waiting logic
  const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);
  console.log("Proof Retrieved:", proof, "\n");

  if (!proof || !proof.response_hex || !proof.proof) {
    console.error("Failed to retrieve a valid proof from the DA Layer.");
    return;
  }

  // 4. Deploy the PriceVerifier and PriceVerifierCustomFeed contracts
  const { priceVerifier, customFeed } = await deployAndVerifyContracts();

  // 5. Send the proof to the PriceVerifier contract for verification and storage
  await interactWithVerifierContract(priceVerifier, proof);

  // 6. Interact with the PriceVerifierCustomFeed contract to read the price
  await interactWithCustomFeedContract(customFeed);

  console.log("--- Price Verification Script Finished ---");
}

// Execute main function
main().catch((error) => {
  console.error("Script failed:", error);
  process.exitCode = 1;
});
