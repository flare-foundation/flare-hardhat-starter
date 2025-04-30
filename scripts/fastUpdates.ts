import {
  FlareContractRegistryAddress,
  flare,
  songbird,
  coston2,
  coston,
} from "@flarenetwork/flare-periphery-contract-artifacts";

// Helper type for network namespaces
type FlareNetworkNamespace = typeof flare | typeof songbird | typeof coston2 | typeof coston;

// Define a mapping for network namespaces
const networkNamespaces: Record<string, FlareNetworkNamespace> = {
  flare,
  songbird,
  coston2,
  coston,
};

// Renamed original function to avoid conflict with the new main wrapper
async function runFastUpdatesListener() {
  const networkName = hre.network.name;

  // Get the correct namespace for the current network
  const currentNetworkNamespace = networkNamespaces[networkName];

  if (!currentNetworkNamespace) {
    throw new Error(`Unsupported network: ${networkName}. Must be one of: flare, songbird, coston2, or coston`);
  }

  // Get a signer instance (assuming one is configured for the network)
  const [signer] = await hre.ethers.getSigners();
  console.log(`Using signer: ${await signer.getAddress()}`); // Optional: Log signer address

  // Get contract registry instance using package ABI and address
  // Connect the signer for consistency
  const registry = new hre.ethers.Contract(
    FlareContractRegistryAddress,
    currentNetworkNamespace.interfaceAbis.IFlareContractRegistry,
    signer
  );

  // Get FastUpdater address
  const fastUpdaterAddress = await registry.getContractAddressByName("FastUpdater");
  console.log(`FastUpdater contract address: ${fastUpdaterAddress}`);

  // Get FastUpdater ABI from the package
  const fastUpdaterAbi = currentNetworkNamespace.nameToAbi("FastUpdater");
  if (!fastUpdaterAbi) {
    throw new Error(`Could not find ABI for FastUpdater on network ${networkName}`);
  }

  // Setup FastUpdater contract using package ABI and connect the signer
  const fastUpdater = new hre.ethers.Contract(
    fastUpdaterAddress,
    fastUpdaterAbi, // Use package ABI
    signer // Use signer instead of provider
  );

  // Get current feeds
  console.log("Calling fastUpdater.fetchAllCurrentFeeds.staticCall()..."); // Update log message
  // Explicitly use staticCall for view functions when a signer is attached
  const allFeedsResult = await fastUpdater.fetchAllCurrentFeeds.staticCall();
  console.log("Raw result from fetchAllCurrentFeeds.staticCall:", allFeedsResult); // Log the raw result

  // Check if the result is iterable (like an array) before destructuring
  if (!allFeedsResult || typeof allFeedsResult[Symbol.iterator] !== "function") {
    console.error("Error: fetchAllCurrentFeeds.staticCall did not return an iterable value.");
    console.error("Received:", allFeedsResult);
    // You might want to investigate the ABI or contract state further here
    throw new Error("Failed to fetch current feeds: Invalid response format from contract.");
  }

  // If the check passes, proceed with destructuring
  const [feedIds, feeds, decimals, timestamp] = allFeedsResult;

  console.log("\nCurrent Feeds:");
  for (let i = 0; i < feedIds.length; i++) {
    try {
      const feedValue = BigInt(feeds[i].toString());
      const decimalValue = parseInt(decimals[i].toString(), 10); // Ensure decimals is a number
      const decimalPower = BigInt(10) ** BigInt(decimalValue);
      // Convert to string first to handle large numbers
      const price = (Number(feedValue.toString()) / Number(decimalPower.toString())).toFixed(decimalValue); // Use actual decimal count for precision
      // Assuming feedIds are bytes, decode them carefully
      // Use ethers.decodeBytes32String if they are truly bytes32, otherwise adjust decoding
      // If they are shorter bytes (e.g., bytes21), padding might be needed or different decoding
      let decodedFeedId = `Bytes: ${feedIds[i]}`; // Fallback representation
      try {
        // Attempt decoding as bytes32, might fail if not padded correctly
        // If feedIds[i] is not 32 bytes long, this will error or give unexpected results.
        // A safer approach depends on the exact bytes length from the contract.
        // For now, let's wrap in try-catch.
        // decodedFeedId = hre.ethers.decodeBytes32String(feedIds[i]); // This assumes feedIds[i] is 32 bytes (64 hex chars + 0x)

        // A more robust way if they are arbitrary bytes: convert to hex string
        decodedFeedId = hre.ethers.hexlify(feedIds[i]);
        // You might want to convert this hex to ASCII if applicable, e.g., using ethers.toUtf8String(bytes)
        // but only if you know it represents UTF8 text.
      } catch (decodeError) {
        console.warn(`Could not decode feedId ${feedIds[i]} as bytes32 string:`, decodeError);
      }
      console.log(`Feed ${decodedFeedId}: ${price} (${decimals[i]} decimals)`);
    } catch (processingError) {
      console.error(`Error processing feed at index ${i} (ID: ${feedIds[i]}):`, processingError);
    }
  }

  // Convert timestamp to Date using BigInt
  const timestampMs = BigInt(timestamp.toString()) * BigInt(1000);
  console.log(`Last Update Timestamp: ${new Date(Number(timestampMs)).toISOString()}`);

  // Get submission window
  const window = await fastUpdater.submissionWindow.staticCall(); // Use staticCall
  console.log(`\nSubmission Window: ${window} blocks`);

  // Get current score cutoff
  const cutoff = await fastUpdater.currentScoreCutoff.staticCall(); // Use staticCall
  console.log(`Current Score Cutoff: ${cutoff.toString()}`);

  // Get update history
  const historySize = 10; // Last 10 blocks
  const updates = await fastUpdater.numberOfUpdates.staticCall(historySize); // Use staticCall

  console.log("\nUpdate History (last 10 blocks):");
  updates.forEach((count: bigint, index: number) => {
    console.log(`Block -${index}: ${count.toString()} updates`);
  });

  // Setup event listener for new updates
  console.log("\nListening for new updates...");

  // Determine WebSocket URL based on network
  let wsUrl: string;
  switch (networkName) {
    case "coston2":
      wsUrl = process.env.COSTON2_WEBSOCKET_URL;
      break;
    case "coston":
      wsUrl = process.env.COSTON_WEBSOCKET_URL;
      break;
    case "songbird":
      wsUrl = process.env.SONGBIRD_WEBSOCKET_URL;
      break;
    case "flare":
      wsUrl = process.env.FLARE_WEBSOCKET_URL;
      break;
    default:
      // Should be caught by the initial check, but good practice
      console.warn(`WebSocket URL not configured in .env for network: ${networkName}. Listener will not start.`);
    // Do not throw error here, allow script to finish initial data fetch
    // throw new Error(`WebSocket URL not configured for network: ${networkName}`);
  }

  // Only proceed with WebSocket if URL is defined
  if (wsUrl) {
    // Create a new provider with a WebSocket connection
    const wsProvider = new hre.ethers.WebSocketProvider(wsUrl);

    // Setup FastUpdater contract for WebSocket using package ABI
    // Using the wsProvider directly is correct for listening to events
    const fastUpdaterWs = new hre.ethers.Contract(
      fastUpdaterAddress,
      fastUpdaterAbi, // Use package ABI
      wsProvider // Use WebSocket provider for listening
    );

    fastUpdaterWs.on("FastUpdateFeedsSubmitted", (votingRoundId, signingPolicyAddress, event) => {
      console.log(`\nNew Update Submitted:`);
      console.log(`Voting Round ID: ${votingRoundId.toString()}`);
      console.log(`Signing Policy Address: ${signingPolicyAddress}`);
      // Access transactionHash via the event object's log property
      // Note: ethers v6 uses event.log.transactionHash, v5 might just use event.transactionHash
      const txHash = event?.log?.transactionHash || event?.transactionHash || "N/A";
      console.log(`Transaction Hash: ${txHash}`);
    });

    // Keep the script running and handle cleanup
    const cleanup = () => {
      console.log("\nClosing WebSocket connection...");
      // Check if wsProvider exists and has destroy method before calling
      if (wsProvider && typeof wsProvider.destroy === "function") {
        wsProvider.destroy();
      }
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Wait indefinitely only if WebSocket is active
    console.log("WebSocket listener active. Press Ctrl+C to exit.");
    await new Promise(() => {});
  } else {
    console.log("WebSocket URL not found. Skipping event listener setup.");
    // Script will exit naturally after fetching initial data
  }
}

// Main wrapper function for standalone execution
async function main() {
  await runFastUpdatesListener();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
