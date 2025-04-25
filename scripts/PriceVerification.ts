import { run, web3 } from "hardhat";
import { PriceVerifierCustomFeedInstance } from "../typechain-types";
import {
  prepareAttestationRequestBase,
  submitAttestationRequest,
  retrieveDataAndProofBase,
} from "./fdcExample/Base";

const PriceVerifierCustomFeed = artifacts.require("PriceVerifierCustomFeed");

const {
  JQ_VERIFIER_URL_TESTNET,
  JQ_VERIFIER_API_KEY_TESTNET,
  COSTON2_DA_LAYER_URL,
} = process.env;

// --- Request Configuration ---

// Define the price to fetch
const priceSymbol = "BTC"; // <--- CHANGE THIS SYMBOL AS NEEDED (e.g., "ETH")

const coinGeckoIds: { [key: string]: string } = {
  BTC: "bitcoin",
  ETH: "ethereum",
};
const coinGeckoId = coinGeckoIds[priceSymbol];
if (!coinGeckoId) {
  throw new Error(`CoinGecko ID not found for symbol: ${priceSymbol}`);
}

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const timestamp = Math.floor(yesterday.getTime() / 1000); // Unix timestamp for yesterday

// Format date for CoinGecko API (dd-mm-yyyy)
const day = String(yesterday.getDate()).padStart(2, '0');
const month = String(yesterday.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
const year = yesterday.getFullYear();
const dateString = `${day}-${month}-${year}`;

const apiUrl = `https://api.coingecko.com/api/v3/coins/${coinGeckoId}/history?date=${dateString}&localization=false`;

// 2. JQ Filter to extract the historical price from CoinGecko and format it as cents
const postprocessJq = `{price: (.market_data.current_price.usd * 100 | floor)}`;

// 3. ABI Signature matching the simplified PriceOnlyData struct in Solidity
// Ensure this matches the struct definition in PriceVerifierCustomFeed.sol
const abiSignature = `{"components": [{"internalType": "uint256","name": "price","type": "uint256"}],"internalType": "struct PriceOnlyData","name": "priceData","type": "tuple"}`;

// --- FDC Configuration ---
const attestationTypeBase = "IJsonApi";
const sourceIdBase = "WEB2";
const verifierUrlBase = JQ_VERIFIER_URL_TESTNET;

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

async function deployAndVerifyContract(): Promise<{
  customFeed: PriceVerifierCustomFeedInstance;
}> {
  console.log("Deploying PriceVerifierCustomFeed contract...");
  // Construct the feed ID using the price variable
  const feedIdString = `${priceSymbol}/USD-HIST`;
  // Convert the string to hex and remove the '0x' prefix
  const feedIdHex = web3.utils.utf8ToHex(feedIdString).substring(2);

  // We need a total of 21 bytes (42 hex chars).
  // The first byte is fixed as '21'.
  // So, we need to pad the feedIdHex to 40 characters (20 bytes).
  const paddedFeedIdHex = feedIdHex.padEnd(40, "0");

  // Prepend the required '21' byte and the '0x' prefix
  const finalFeedIdHex = `0x21${paddedFeedIdHex}`;

  // Ensure the final length is correct (0x + 42 hex chars = 21 bytes)
  if (finalFeedIdHex.length !== 44) {
    throw new Error(
      `Generated feed ID has incorrect length: ${finalFeedIdHex.length}. Expected 44 characters (0x + 42 hex). Feed string: ${feedIdString}`
    );
  }

  console.log("Final Feed ID Hex (bytes21 with 0x21 prefix):", finalFeedIdHex);

  // Pass the correctly formatted bytes21 value AND the expected symbol to the constructor
  const customFeedArgs: any[] = [finalFeedIdHex, priceSymbol];
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

  return { customFeed };
}

async function submitProofToCustomFeed(
  customFeed: PriceVerifierCustomFeedInstance,
  proof: any
) {
  console.log("Submitting proof to PriceVerifierCustomFeed contract...");
  // proof.response_hex contains the ABI-encoded 'data' part of the IJsonApi.Proof struct
  console.log(
    "Raw Proof Data Hex (IJsonApi.Proof.data):",
    proof.response_hex,
    "\n"
  );

  // --- Dynamically determine the ABI structure for decoding the proof data ---
  const IJsonApiVerification = await artifacts.require("IJsonApiVerification");
  const verifyJsonApiAbi = IJsonApiVerification._json.abi.find(
    (item: any) => item.name === "verifyJsonApi" && item.type === "function"
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

  const proofInputDefinition = verifyJsonApiAbi.inputs[0];
  if (
    !proofInputDefinition ||
    proofInputDefinition.type !== "tuple" ||
    !proofInputDefinition.components
  ) {
    throw new Error(
      "Expected 'verifyJsonApi' input to be a tuple (struct IJsonApi.Proof) in IJsonApiVerification ABI. ABI structure might have changed."
    );
  }

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
    proofDataAbiDefinition,
    proof.response_hex
  );

  console.log("Decoded Proof Data:", decodedProofData, "\n");

  // Prepare the full proof structure for the contract call, matching the IJsonApi.Proof struct expected by verifyPrice
  const contractProofArgument = {
    merkleProof: proof.proof,
    data: decodedProofData,
  };

  console.log(
    "Calling verifyPrice function on CustomFeed with structured proof argument:",
    contractProofArgument,
    "\n"
  );

  // Call verifyPrice on the customFeed contract instance
  const transaction = await customFeed.verifyPrice(contractProofArgument);
  console.log("Transaction successful! TX Hash:", transaction.tx);
  console.log("Gas used:", transaction.receipt.gasUsed, "\n");

  // Check the stored price directly from the custom feed contract's public state variable
  const latestPrice = await customFeed.latestVerifiedPrice(); // Call the public getter
  console.log(
    `Latest verified price stored in PriceVerifierCustomFeed (USD cents): ${latestPrice.toString()}`
  );
  // Also fetch and log the timestamp
  const latestTimestamp = await customFeed.latestVerifiedTimestamp();
  console.log(
    `Timestamp associated with the price: ${latestTimestamp.toString()} (Unix timestamp)`
  );
  console.log(
    `Timestamp corresponds to: ${new Date(
      Number(latestTimestamp) * 1000
    ).toUTCString()}`
  );
  console.log(`Which is $${(Number(latestPrice) / 100).toFixed(4)}\n`);
}

async function interactWithCustomFeedContract(
  customFeed: PriceVerifierCustomFeedInstance
) {
  console.log("Interacting with PriceVerifierCustomFeed contract...");

  // Call the read() function (simulating FTSO system call or consumer reading)
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

  const feedIdResult = await customFeed.feedId();
  console.log(`  Feed ID (Hex): ${feedIdResult}\n`);

  console.log("Calling getFeedDataView() for off-chain reading:");
  const feedDataResult = await customFeed.getFeedDataView();

  const currentValue = feedDataResult[0];
  const currentDecimals = feedDataResult[1];
  const currentTimestamp = feedDataResult[2];

  console.log(`  Value: ${currentValue.toString()}`);
  console.log(`  Decimals: ${currentDecimals.toString()}`);
  console.log(`  Timestamp: ${currentTimestamp.toString()}`);
  console.log(
    `  Timestamp corresponds to: ${new Date(
      Number(currentTimestamp) * 1000
    ).toUTCString()}\n`
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
  const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);
  console.log("Proof Retrieved:", proof, "\n");

  if (!proof || !proof.response_hex || !proof.proof) {
    console.error("Failed to retrieve a valid proof from the DA Layer.");
    return;
  }

  // 4. Deploy the combined PriceVerifierCustomFeed contract
  const { customFeed } = await deployAndVerifyContract();

  // 5. Send the proof to the PriceVerifierCustomFeed contract for verification and storage
  await submitProofToCustomFeed(customFeed, proof);

  // 6. Interact with the PriceVerifierCustomFeed contract to read the price/feed data
  await interactWithCustomFeedContract(customFeed);

  console.log("--- Price Verification Script Finished ---");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
