import {
  FlareContractRegistryAddress,
  flare,
  songbird,
  coston2,
  coston,
} from "@flarenetwork/flare-periphery-contract-artifacts";
import { Contract } from "ethers";

// Helper type for network namespaces
type FlareNetworkNamespace =
  | typeof flare
  | typeof songbird
  | typeof coston2
  | typeof coston;

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
  currentNetworkNamespace: FlareNetworkNamespace
): Promise<Contract | any> {
  const provider = hre.ethers.provider;

  const iFlareContractRegistryAddress = FlareContractRegistryAddress;

  const iFlareContractRegistryArtifact =
    currentNetworkNamespace.interfaceAbis.IFlareContractRegistry;

  const flareRegistry = new hre.ethers.Contract(
    iFlareContractRegistryAddress,
    iFlareContractRegistryArtifact,
    provider
  );

  const ftsoV2Address = await flareRegistry.getContractAddressByName("FtsoV2");

  const ftsoV2Artifact = currentNetworkNamespace.interfaceAbis.FtsoV2Interface;

  return new hre.ethers.Contract(ftsoV2Address, ftsoV2Artifact, provider);
}

async function verifyFeedDataOnChain(
  ftsoV2Contract: Contract | any,
  feedDataWithProof: any
): Promise<boolean> {
  try {
    if (
      !feedDataWithProof ||
      !feedDataWithProof.body ||
      !feedDataWithProof.proof
    ) {
      console.error(
        `Invalid feed data structure for verification:`,
        feedDataWithProof
      );
      return false;
    }

    const isValid = await ftsoV2Contract.verifyFeedData({
      proof: feedDataWithProof.proof,
      body: {
        votingRoundId: feedDataWithProof.body.votingRoundId,
        id: feedDataWithProof.body.id,
        value: feedDataWithProof.body.value,
        turnoutBIPS: feedDataWithProof.body.turnoutBIPS,
        decimals: feedDataWithProof.body.decimals,
      },
    });

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
      "x-apikey": process.env.FLARE_API_KEY || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      feed_ids: [feedId],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `HTTP error! Status: ${response.status} for feed_id: ${feedId}. Body: ${errorBody}`
    );
  }

  const responseData = await response.json();
  if (!Array.isArray(responseData) || responseData.length === 0) {
    throw new Error(
      `Unexpected response format or empty data for feed_id: ${feedId}`
    );
  }
  return responseData[0];
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function processPriceFeeds(
  ftsoV2Contract: Contract | any,
  apiUrlGetProofs: string,
  feedIds: string[]
): Promise<PriceDataResult> {
  const allResponses = [];
  const verificationResults = [];

  for (const feedId of feedIds) {
    try {
      const feedData = await fetchPriceData(apiUrlGetProofs, feedId);
      allResponses.push(feedData);

      const isValid = await verifyFeedDataOnChain(ftsoV2Contract, feedData);
      console.log(`Verification for ${feedId}: ${isValid}`);
      verificationResults.push({
        feedId,
        isValid,
        data: feedData,
      });

      await delay(200);
    } catch (error: any) {
      console.error(`Failed to process feed ${feedId}:`, error.message);
      verificationResults.push({
        feedId,
        isValid: false,
        data: null,
        error: error.message,
      });
      await delay(100);
    }
  }

  return {
    responses: allResponses,
    verifications: verificationResults,
  };
}

async function main() {
  try {
    const networkName = hre.network.name;

    const currentNetworkNamespace = networkNamespaces[networkName];
    if (!currentNetworkNamespace) {
      throw new Error(
        `Unsupported network: ${networkName}. Must be one of: ${Object.keys(networkNamespaces).join(", ")}`
      );
    }

    const currentNetwork = networks[networkName];
    if (!currentNetwork || !currentNetwork.url) {
      throw new Error(
        `Network configuration or DA Layer URL not found for ${networkName} in .env file`
      );
    }

    const apiUrlFeedNames = `${currentNetwork.url}/api/v0/ftso/anchor-feed-names`;
    const apiUrlGetProofs = `${currentNetwork.url}/api/v0/ftso/anchor-feeds-with-proof`;

    const ftsoV2Contract = await initializeFtsoV2Contract(
      currentNetworkNamespace
    );

    const response = await fetch(apiUrlFeedNames, {
      headers: {
        "x-apikey": process.env.FLARE_API_KEY || "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `HTTP error fetching feed names! Status: ${response.status}. Body: ${errorBody}`
      );
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error(
        `Unexpected response format when fetching feed names. Expected array, got: ${JSON.stringify(data)}`
      );
    }
    const feedIds = data.map((item: any) => item.feed_id);

    const priceDataResult = await processPriceFeeds(
      ftsoV2Contract,
      apiUrlGetProofs,
      feedIds
    );
    console.log("Price Data Fetch and Verification Complete:");
    console.log(JSON.stringify(priceDataResult, null, 2));
  } catch (error: any) {
    console.error(`Error in main execution:`, error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
