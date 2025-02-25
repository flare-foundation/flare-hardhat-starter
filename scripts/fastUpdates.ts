import { HardhatRuntimeEnvironment } from "hardhat/types";
import type { ethers } from "ethers";
import { FLARE_CONTRACT_REGISTRY_ADDRESS } from "../lib/constants";

export async function getFastUpdates(hre: HardhatRuntimeEnvironment) {
  const networkName = hre.network.name;
  if (!["flare", "songbird", "coston2"].includes(networkName)) {
    throw new Error(
      `Unsupported network: ${networkName}. Must be one of: flare, songbird, or coston2`
    );
  }

  // Get contract registry instance
  const registryAbi = [
    "function getContractAddressByName(string) view returns (address)",
  ];
  const registry = new hre.ethers.Contract(
    FLARE_CONTRACT_REGISTRY_ADDRESS,
    registryAbi,
    hre.ethers.provider
  );

  // Get FastUpdater address
  const fastUpdaterAddress = await registry.getContractAddressByName(
    "FastUpdater"
  );
  console.log(`FastUpdater contract address: ${fastUpdaterAddress}`);

  // Setup FastUpdater contract
  const fastUpdaterAbi = [
    "function fetchAllCurrentFeeds() view returns (bytes21[], uint256[], int8[], uint64)",
    "function numberOfUpdates(uint256) view returns (uint256[])",
    "function currentScoreCutoff() view returns (uint256)",
    "function submissionWindow() view returns (uint8)",
    "event FastUpdateFeedsSubmitted(uint256 indexed votingRoundId, address indexed signingPolicyAddress)",
  ];

  const fastUpdater = new hre.ethers.Contract(
    fastUpdaterAddress,
    fastUpdaterAbi,
    hre.ethers.provider
  );

  // Get current feeds
  const [feedIds, feeds, decimals, timestamp] =
    await fastUpdater.fetchAllCurrentFeeds();

  console.log("\nCurrent Feeds:");
  for (let i = 0; i < feedIds.length; i++) {
    const feedValue = BigInt(feeds[i].toString());
    const decimalPower = BigInt(10) ** BigInt(decimals[i]);
    // Convert to string first to handle large numbers
    const price = (
      Number(feedValue.toString()) / Number(decimalPower.toString())
    ).toFixed(8);
    console.log(`Feed ${feedIds[i]}: ${price} (${decimals[i]} decimals)`);
  }

  // Convert timestamp to Date using BigInt
  const timestampMs = BigInt(timestamp.toString()) * BigInt(1000);
  console.log(
    `Last Update Timestamp: ${new Date(Number(timestampMs)).toISOString()}`
  );

  // Get submission window
  const window = await fastUpdater.submissionWindow();
  console.log(`\nSubmission Window: ${window} blocks`);

  // Get current score cutoff
  const cutoff = await fastUpdater.currentScoreCutoff();
  console.log(`Current Score Cutoff: ${cutoff.toString()}`);

  // Get update history
  const historySize = 10; // Last 10 blocks
  const updates = await fastUpdater.numberOfUpdates(historySize);

  console.log("\nUpdate History (last 10 blocks):");
  updates.forEach((count: bigint, index: number) => {
    console.log(`Block -${index}: ${count.toString()} updates`);
  });

  // Setup event listener for new updates
  console.log("\nListening for new updates...");

  // Create a new provider with a WebSocket connection
  const wsProvider = new hre.ethers.WebSocketProvider(
    process.env.COSTON2_WEBSOCKET_URL ||
      "wss://coston2-api.flare.network/ext/C/ws"
  );

  const fastUpdaterWs = new hre.ethers.Contract(
    fastUpdaterAddress,
    fastUpdaterAbi,
    wsProvider
  );

  fastUpdaterWs.on(
    "FastUpdateFeedsSubmitted",
    (votingRoundId, signingPolicyAddress, event) => {
      console.log(`\nNew Update Submitted:`);
      console.log(`Voting Round ID: ${votingRoundId.toString()}`);
      console.log(`Signing Policy Address: ${signingPolicyAddress}`);
      console.log(`Transaction Hash: ${event.transactionHash}`);
    }
  );

  // Keep the script running and handle cleanup
  const cleanup = () => {
    console.log("\nClosing WebSocket connection...");
    wsProvider.destroy();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Wait indefinitely
  await new Promise(() => {});
}
