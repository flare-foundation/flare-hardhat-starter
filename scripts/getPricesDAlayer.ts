import { HardhatRuntimeEnvironment } from "hardhat/types";

interface NetworkConfig {
  url: string;
}

interface VerificationResult {
  feedId: string;
  isValid: boolean;
  data: any;
}

interface PriceDataResult {
  responses: any[];
  verifications: VerificationResult[];
}

// Network configuration mapping
const networks: Record<string, NetworkConfig> = {
  flare: {
    url: process.env.DA_LAYER_URL_FLARE,
  },
  songbird: {
    url: process.env.DA_LAYER_URL_SONGBIRD,
  },
  coston2: {
    url: process.env.DA_LAYER_URL_COSTON2,
  },
};

async function initializeFtsoV2Contract(hre: HardhatRuntimeEnvironment) {
  const web3 = hre.web3;
  const artifacts = hre.artifacts;

  const iFlareContractRegistryAddress = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";
  
  const iFlareContractRegistryArtifact = artifacts.readArtifactSync(
    "@flarenetwork/flare-periphery-contracts/coston2/IFlareContractRegistry.sol:IFlareContractRegistry"
  );
  
  const flareRegistry = new web3.eth.Contract(
    iFlareContractRegistryArtifact.abi,
    iFlareContractRegistryAddress
  );

  const ftsoV2Address = await flareRegistry.methods
    .getContractAddressByName("FtsoV2")
    .call();

  const ftsoV2Artifact = await artifacts.readArtifact(
    "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol:FtsoV2Interface"
  );

  return new web3.eth.Contract(ftsoV2Artifact.abi, ftsoV2Address);
}

async function verifyFeedDataOnChain(ftsoV2Contract: any, feedDataWithProof: any) {
  try {
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
    console.error(
      `Error verifying feed data for ID ${feedDataWithProof.body.id}:`,
      error
    );
    return false;
  }
}

async function fetchPriceData(apiUrl: string, feedId: string): Promise<any> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "x-apikey": process.env.FLARE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      feed_ids: [feedId],
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status} for feed_id: ${feedId}`);
  }

  const responseData = await response.json();
  return responseData[0];
}

async function processPriceFeeds(
  ftsoV2Contract: any,
  apiUrlGetProofs: string,
  feedIds: string[]
): Promise<PriceDataResult> {
  const allResponses = [];
  const verificationResults = [];

  for (const feedId of feedIds) {
    const feedData = await fetchPriceData(apiUrlGetProofs, feedId);
    allResponses.push(feedData);

    const isValid = await verifyFeedDataOnChain(ftsoV2Contract, feedData);
    console.log(isValid);
    verificationResults.push({
      feedId,
      isValid,
      data: feedData,
    });
  }

  return {
    responses: allResponses,
    verifications: verificationResults,
  };
}

export async function getPriceData(hre: HardhatRuntimeEnvironment) {
  try {
    const networkName = hre.network.name;

    // Network validation
    if (!["flare", "songbird", "coston2"].includes(networkName)) {
      throw new Error(
        `Unsupported network: ${networkName}. Must be one of: flare, songbird, or coston2`
      );
    }

    const currentNetwork = networks[networkName as keyof typeof networks];
    const apiUrlFeedNames = `${currentNetwork.url}/api/v0/ftso/anchor-feed-names`;
    const apiUrlGetProofs = `${currentNetwork.url}/api/v0/ftso/anchor-feeds-with-proof`;

    const ftsoV2Contract = await initializeFtsoV2Contract(hre);

    const response = await fetch(apiUrlFeedNames, {
      headers: {
        "x-apikey": process.env.FLARE_API_KEY || "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const feedIds = data.map((item: any) => item.feed_id);
    
    return await processPriceFeeds(ftsoV2Contract, apiUrlGetProofs, feedIds);
  } catch (error) {
    console.error(`Error in getPriceData:`, error);
    process.exit(1);
  }
}

// Usage
getPriceData(hre)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
