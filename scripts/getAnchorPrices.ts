import { HardhatRuntimeEnvironment } from "hardhat/types";
import hre from "hardhat"; // Import hre directly for standalone execution
import {
  FlareContractRegistryAddress,
  flare,
  songbird,
  coston2,
  coston,
} from "@flarenetwork/flare-periphery-contract-artifacts";

// Helper type for network namespaces
type FlareNetworkNamespace = typeof flare | typeof songbird | typeof coston2 | typeof coston;

interface NetworkConfig {
  url: string | undefined;
}

interface VerificationResult {
  feedId: string;
  isValid: boolean;
  data: any;
  error?: string;
}

interface PriceDataResult {
  responses: any[];
  verifications: VerificationResult[];
}

// Network configuration mapping
const networks: Record<string, NetworkConfig> = {
  flare: {
    url: process.env.FLARE_DA_LAYER_URL,
  },
  songbird: {
    url: process.env.SONGBIRD_DA_LAYER_URL,
  },
  coston: {
    url: process.env.COSTON_DA_LAYER_URL,
  },
  coston2: {
    url: process.env.COSTON2_DA_LAYER_URL,
  },
};

// Define a mapping for network namespaces
const networkNamespaces: Record<string, FlareNetworkNamespace> = {
  flare,
  songbird,
  coston2,
  coston,
};

// Warning: To avoid rate limiting, use only one feedId to check.
async function initializeFtsoV2Contract(
  hre: HardhatRuntimeEnvironment,
  currentNetworkNamespace: FlareNetworkNamespace,
) {
  const web3 = hre.web3; // Using web3 as per original script

  // Use the imported constant address
  const iFlareContractRegistryAddress = FlareContractRegistryAddress;

  // Get ABI using the package's network-specific namespace
  const iFlareContractRegistryArtifact =
    currentNetworkNamespace.interfaceAbis.IFlareContractRegistry;

  const flareRegistry = new web3.eth.Contract(
    iFlareContractRegistryArtifact,
    iFlareContractRegistryAddress,
  );

  const ftsoV2Address = await flareRegistry.methods.getContractAddressByName("FtsoV2").call();

  // Get FtsoV2 ABI using the package
  const ftsoV2Artifact = currentNetworkNamespace.interfaceAbis.FtsoV2Interface;

  return new web3.eth.Contract(ftsoV2Artifact, ftsoV2Address);
}

async function verifyFeedDataOnChain(ftsoV2Contract: any, feedDataWithProof: any) {
  try {
    // Ensure all parts of the body exist before calling
    if (!feedDataWithProof || !feedDataWithProof.body || !feedDataWithProof.proof) {
      console.error(`Invalid feed data structure for verification:`, feedDataWithProof);
      return false;
    }

    const isValid = await ftsoV2Contract.methods
      .verifyFeedData({
        proof: feedDataWithProof.proof,
        body: {
          votingRoundId: feedDataWithProof.body.votingRoundId,
          id: feedDataWithProof.body.id,
          value: feedDataWithProof.body.value,
          turnoutBIPS: feedDataWithProof.body.turnoutBIPS,
          decimals: feedDataWithProof.body.decimals,
        },
      })
      .call();

    return isValid;
  } catch (error) {
    const feedId = feedDataWithProof?.body?.id || "unknown";
    console.error(`Error verifying feed data for ID ${feedId}:`, error);
    return false;
  }
}

async function fetchPriceData(apiUrl: string, feedId: string): Promise<any> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "x-apikey": process.env.FLARE_API_KEY || "", // Ensure fallback for API key
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      feed_ids: [feedId],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `HTTP error! Status: ${response.status} for feed_id: ${feedId}. Body: ${errorBody}`,
    );
  }

  const responseData = await response.json();
  // Check if responseData is an array and has at least one element
  if (!Array.isArray(responseData) || responseData.length === 0) {
    throw new Error(`Unexpected response format or empty data for feed_id: ${feedId}`);
  }
  return responseData[0];
}

// Helper function for creating a delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function processPriceFeeds(
  ftsoV2Contract: any,
  apiUrlGetProofs: string,
  feedIds: string[],
): Promise<PriceDataResult> {
  const allResponses = [];
  const verificationResults = [];

  for (const feedId of feedIds) {
    try {
      // Add try...catch around the fetch and verify logic for individual feeds
      const feedData = await fetchPriceData(apiUrlGetProofs, feedId);
      allResponses.push(feedData);

      const isValid = await verifyFeedDataOnChain(ftsoV2Contract, feedData);
      console.log(`Verification for ${feedId}: ${isValid}`); // Log which feed is being verified
      verificationResults.push({
        feedId,
        isValid,
        data: feedData,
      });

      // Introduce a delay (e.g., 200 milliseconds) between requests
      await delay(200); // Adjust the delay time (in ms) as needed
    } catch (error: any) {
      // Log errors for individual feeds but continue processing others
      console.error(`Failed to process feed ${feedId}:`, error.message);
      // Optionally push an error status to results if needed
      verificationResults.push({
        feedId,
        isValid: false, // Mark as invalid or add an error field
        data: null, // Or include error information
        error: error.message,
      });
      // Decide if you want to add a delay even after an error
      await delay(100); // Shorter delay after an error? Or maybe longer?
    }
  }

  return {
    responses: allResponses,
    verifications: verificationResults,
  };
}

// Main execution function for standalone script
async function main() {
  try {
    const networkName = hre.network.name;

    // Get the correct namespace for the current network
    const currentNetworkNamespace = networkNamespaces[networkName];
    if (!currentNetworkNamespace) {
      throw new Error(
        `Unsupported network: ${networkName}. Must be one of: ${Object.keys(networkNamespaces).join(", ")}`,
      );
    }

    const currentNetwork = networks[networkName];
    if (!currentNetwork || !currentNetwork.url) {
      throw new Error(
        `Network configuration or DA Layer URL not found for ${networkName} in .env file`,
      );
    }

    const apiUrlFeedNames = `${currentNetwork.url}/api/v0/ftso/anchor-feed-names`;
    const apiUrlGetProofs = `${currentNetwork.url}/api/v0/ftso/anchor-feeds-with-proof`;

    // Initialize contract using the correct network namespace
    const ftsoV2Contract = await initializeFtsoV2Contract(hre, currentNetworkNamespace);

    const response = await fetch(apiUrlFeedNames, {
      headers: {
        "x-apikey": process.env.FLARE_API_KEY || "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `HTTP error fetching feed names! Status: ${response.status}. Body: ${errorBody}`,
      );
    }

    const data = await response.json();
    // Ensure data is an array before mapping
    if (!Array.isArray(data)) {
      throw new Error(
        `Unexpected response format when fetching feed names. Expected array, got: ${JSON.stringify(data)}`,
      );
    }
    const feedIds = data.map((item: any) => item.feed_id);

    // Log the result before returning from the function called by the task
    const priceDataResult = await processPriceFeeds(ftsoV2Contract, apiUrlGetProofs, feedIds);
    console.log("Price Data Fetch and Verification Complete:");
    console.log(JSON.stringify(priceDataResult, null, 2));
    // return priceDataResult; // Return value is not typically used in standalone scripts like this
  } catch (error) {
    // Log the error but let the task handler manage exit codes
    console.error(`Error in main execution:`, error);
    // Re-throw the error so the task runner catches it and exits with non-zero code
    throw error;
  }
}

// Standard Hardhat script execution pattern
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });