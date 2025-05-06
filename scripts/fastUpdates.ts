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

async function runFastUpdatesListener() {
    const networkName = hre.network.name;

    const currentNetworkNamespace = networkNamespaces[networkName];

    if (!currentNetworkNamespace) {
        throw new Error(`Unsupported network: ${networkName}. Must be one of: flare, songbird, coston2, or coston`);
    }

    const [signer] = await hre.ethers.getSigners();
    console.log(`Using signer: ${await signer.getAddress()}`); // Optional: Log signer address

    const registry = new hre.ethers.Contract(
        FlareContractRegistryAddress,
        currentNetworkNamespace.interfaceAbis.IFlareContractRegistry,
        signer
    );

    const fastUpdaterAddress = await registry.getContractAddressByName("FastUpdater");
    console.log(`FastUpdater contract address: ${fastUpdaterAddress}`);

    const fastUpdaterAbi = currentNetworkNamespace.nameToAbi("FastUpdater");
    if (!fastUpdaterAbi) {
        throw new Error(`Could not find ABI for FastUpdater on network ${networkName}`);
    }

    const fastUpdater = new hre.ethers.Contract(fastUpdaterAddress, fastUpdaterAbi, signer);

    // Get current feeds
    console.log("Calling fastUpdater.fetchAllCurrentFeeds.staticCall()...");
    const allFeedsResult = await fastUpdater.fetchAllCurrentFeeds.staticCall();
    console.log("Raw result from fetchAllCurrentFeeds.staticCall:", allFeedsResult);

    if (!allFeedsResult || typeof allFeedsResult[Symbol.iterator] !== "function") {
        console.error("Error: fetchAllCurrentFeeds.staticCall did not return an iterable value.");
        console.error("Received:", allFeedsResult);
        throw new Error("Failed to fetch current feeds: Invalid response format from contract.");
    }

    const [feedIds, feeds, decimals, timestamp] = allFeedsResult;

    console.log("\nCurrent Feeds:");
    for (let i = 0; i < feedIds.length; i++) {
        try {
            const feedValue = BigInt(feeds[i].toString());
            const decimalValue = parseInt(decimals[i].toString(), 10);
            const decimalPower = BigInt(10) ** BigInt(decimalValue);
            const price = (Number(feedValue.toString()) / Number(decimalPower.toString())).toFixed(decimalValue); // Use actual decimal count for precision
            let decodedFeedId = `Bytes: ${feedIds[i]}`;
            try {
                decodedFeedId = hre.ethers.hexlify(feedIds[i]);
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
            console.warn(`WebSocket URL not configured in .env for network: ${networkName}. Listener will not start.`);
    }

    if (wsUrl) {
        const wsProvider = new hre.ethers.WebSocketProvider(wsUrl);
        const fastUpdaterWs = new hre.ethers.Contract(fastUpdaterAddress, fastUpdaterAbi, wsProvider);

        fastUpdaterWs.on("FastUpdateFeedsSubmitted", (votingRoundId, signingPolicyAddress, event) => {
            console.log(`\nNew Update Submitted:`);
            console.log(`Voting Round ID: ${votingRoundId.toString()}`);
            console.log(`Signing Policy Address: ${signingPolicyAddress}`);
            const txHash = event?.log?.transactionHash || event?.transactionHash || "N/A";
            console.log(`Transaction Hash: ${txHash}`);
        });

        const cleanup = () => {
            console.log("\nClosing WebSocket connection...");
            if (wsProvider && typeof wsProvider.destroy === "function") {
                wsProvider.destroy();
            }
            process.exit(0);
        };

        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);

        console.log("WebSocket listener active. Press Ctrl+C to exit.");
        await new Promise(() => {});
    } else {
        console.log("WebSocket URL not found. Skipping event listener setup.");
    }
}

async function main() {
    await runFastUpdatesListener();
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
