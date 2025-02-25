import { HardhatRuntimeEnvironment } from "hardhat/types";

export async function getPriceData(hre: HardhatRuntimeEnvironment) {
  const web3 = hre.web3;
  const artifacts = hre.artifacts;
  const networkName = hre.network.name;

  // Get FtsoV2 address from registry
  const iFlareContractRegistryAddress =
    "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

  const iFlareContractRegistryArtifact = artifacts.readArtifactSync(
    "@flarenetwork/flare-periphery-contracts/coston2/IFlareContractRegistry.sol:IFlareContractRegistry"
  );
  const flareRegistry = new web3.eth.Contract(
    iFlareContractRegistryArtifact.abi,
    iFlareContractRegistryAddress
  );

  // Get FtsoV2 address from registry
  const ftsoV2Address = await flareRegistry.methods
    .getContractAddressByName("FtsoV2")
    .call();

  // Load FtsoV2Interface contract ABI and create instance
  const ftsoV2Artifact = await artifacts.readArtifact(
    "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol:FtsoV2Interface"
  );
  const ftsoV2Contract = new web3.eth.Contract(
    ftsoV2Artifact.abi,
    ftsoV2Address
  );

  // Network configurations
  const networks = {
    flare: {
      url: "https://flr-data-availability.flare.network",
    },
    songbird: {
      url: "https://sgb-data-availability.flare.network",
    },
    coston2: {
      url: "https://ctn2-data-availability.flare.network",
    },
  };

  // Validate network
  if (!["flare", "songbird", "coston2"].includes(networkName)) {
    throw new Error(
      `Unsupported network: ${networkName}. Must be one of: flare, songbird, or coston2`
    );
  }

  // Type assertion to use networkName as key
  const currentNetwork = networks[networkName as keyof typeof networks];

  const apiUrlFeedNames = `${currentNetwork.url}/api/v0/ftso/anchor-feed-names`;
  const apiUrlGetProofs = `${currentNetwork.url}/api/v0/ftso/anchor-feeds-with-proof`;

  async function verifyFeedDataOnChain(feedDataWithProof: any) {
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

  async function getPriceData(data: any) {
    const feedIds = data.map((item: any) => item.feed_id);
    const allResponses = [];
    const verificationResults = [];

    // Iterate through each feed_id and make individual requests
    for (const feedId of feedIds) {
      const response = await fetch(apiUrlGetProofs, {
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
        throw new Error(
          `HTTP error! Status: ${response.status} for feed_id: ${feedId}`
        );
      }
      const responseData = await response.json();
      const feedData = responseData[0];
      allResponses.push(feedData);

      // Verify the feed data on-chain
      const isValid = await verifyFeedDataOnChain(feedData);
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

  // Main processing function
  const main = async () => {
    try {
      const response = await fetch(apiUrlFeedNames, {
        headers: {
          "x-apikey": process.env.FLARE_API_KEY,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      return await getPriceData(data);
    } catch (error) {
      console.error(`Error fetching price data from ${networkName}:`, error);
      return null;
    }
  };

  // Call the main function
  return await main();
}
