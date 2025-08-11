import hre from "hardhat";
import { run } from "hardhat";
import { FtsoV2AnchorFeedConsumerInstance } from "../typechain-types";

// Feed IDs, see https://dev.flare.network/ftso/scaling/anchor-feeds for full list
const FEED_IDS = [
    "0x01464c522f55534400000000000000000000000000", // FLR/USD
    "0x014254432f55534400000000000000000000000000", // BTC/USD
    "0x014554482f55534400000000000000000000000000", // ETH/USD
];

// Structs our contract is expecting
type FeedData = {
    votingRoundId: number;
    id: string;
    value: number;
    turnoutBIPS: number;
    decimals: number;
};

type FeedDataWithProof = {
    proof: string[];
    body: FeedData;
};

// Helper function decoding the Hex of the FeedId for demonstration purposes
function decodeFeedId(idHex: string): { category: string; label: string } {
    const hex = idHex.startsWith("0x") ? idHex.slice(2) : idHex;
    const bytes = Buffer.from(hex, "hex");
    if (bytes.length !== 21) return { category: "Unknown", label: idHex };
    const categoryByte = bytes[0];
    let end = bytes.findIndex(b => b === 0x00, 1);
    if (end === -1) end = bytes.length;
    const label = bytes.slice(1, end).toString("ascii");
    const category = categoryByte === 0x01 ? "Crypto" : `0x${categoryByte.toString(16).padStart(2, "0")}`;
    return { category, label: label || idHex };
}

/**
 * Fetches anchor feed data from the DA Layer.
 */
async function fetchAnchorFeeds(): Promise<string> {
    const daLayerProofsUrl = `${process.env.COSTON2_DA_LAYER_URL}/api/v0/ftso/anchor-feeds-with-proof`;
    try {
        const response = await fetch(daLayerProofsUrl, {
            method: "POST",
            headers: { "x-apikey": process.env.X_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ feed_ids: FEED_IDS }),
        });
        const text = await response.text();
        console.log("DA Layer raw response:", text);
        if (!response.ok) throw new Error(`DA layer returned ${response.status}: ${text}`);
        return text;
    } catch (e) {
        console.error("Error fetching anchor feeds:", e);
        throw e;
    }
}

/**
 * Parses and validates the raw response from the DA layer into a structured format.
 */
function parseAndNormalizeFeeds(rawResponse: string): FeedDataWithProof[] {
    const feedsFromDALayer = JSON.parse(rawResponse) as any[];
    if (!Array.isArray(feedsFromDALayer)) {
        throw new Error(`Unexpected DA response. Expected an array, got: ${rawResponse}`);
    }

    return feedsFromDALayer
        .map(feed => {
            const body = feed?.body ?? feed?.data;
            const proof = feed?.proof as string[] | undefined;

            if (!body || !Array.isArray(proof)) {
                console.warn(`Skipping malformed data from DA: ${JSON.stringify(feed)}`);
                return null; // Will be filtered out later
            }

            return {
                proof,
                body: {
                    votingRoundId: Number(body.votingRoundId),
                    id: String(body.id),
                    value: Number(body.value),
                    turnoutBIPS: Number(body.turnoutBIPS),
                    decimals: Number(body.decimals),
                },
            };
        })
        .filter(Boolean) as FeedDataWithProof[]; // filter(Boolean) removes any null entries
}

/**
 * Deploys the FtsoV2AnchorFeedConsumer contract.
 */
async function deployConsumerContract(): Promise<FtsoV2AnchorFeedConsumerInstance> {
    const FtsoV2AnchorFeedConsumer = await hre.artifacts.readArtifact("FtsoV2AnchorFeedConsumer");
    const factory = await hre.ethers.getContractFactory(
        FtsoV2AnchorFeedConsumer.abi,
        FtsoV2AnchorFeedConsumer.bytecode
    );
    const feedConsumer = await factory.deploy();
    await feedConsumer.waitForDeployment();
    console.log("FtsoV2AnchorFeedConsumer deployed at:", await feedConsumer.getAddress());

    try {
        await run("verify:verify", {
            address: await feedConsumer.getAddress(),
            constructorArguments: [],
        });
    } catch (e: any) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Contract is already verified.");
        } else {
            console.error("Error verifying contract:", e.message);
        }
    }
    return feedConsumer as unknown as FtsoV2AnchorFeedConsumerInstance;
}

/**
 * Submits a proof to the contract and reads the saved value back.
 */
async function interactWithContract(
    feedConsumer: FtsoV2AnchorFeedConsumerInstance,
    feedDataWithProof: FeedDataWithProof
) {
    const { label, category } = decodeFeedId(feedDataWithProof.body.id);
    console.log(`\n--- Processing ${label} [${category}] ---`);

    // Use a static call first to verify the proof without spending gas on a transaction
    try {
        await feedConsumer.savePrice.staticCall(feedDataWithProof);
        console.log(`Proof for ${label} verified successfully (static call).`);
    } catch (e) {
        console.error(`Proof verification for ${label} failed:`, e);
        throw e; // Re-throw to stop the script if verification fails
    }

    // If the static call succeeds, send the actual transaction
    const tx = await feedConsumer.savePrice(feedDataWithProof);
    await tx.wait();
    console.log(`savePrice() transaction for ${label} mined: ${tx.hash}`);

    // Read the value back from the contract to confirm it was saved correctly
    const saved = await feedConsumer.provenFeeds(feedDataWithProof.body.votingRoundId, feedDataWithProof.body.id);
    const formattedPrice = Number(saved.value) * Math.pow(10, -Number(saved.decimals));

    console.log(`✅ Saved price: ${formattedPrice} at voting round: ${saved.votingRoundId.toString()}`);
}

async function main() {
    // 1. Fetch raw data from the Data Availability Layer
    const rawResponse = await fetchAnchorFeeds();

    // 2. Parse and validate the raw data into a structured format
    const feeds = parseAndNormalizeFeeds(rawResponse);
    if (feeds.length === 0) {
        console.log("No valid feeds found in the response. Exiting.");
        return;
    }

    // 3. Deploy the consumer contract that will receive the data
    const feedConsumer = await deployConsumerContract();

    // 4. Process each feed by sending a transaction to the contract
    for (const feed of feeds) {
        await interactWithContract(feedConsumer, feed);
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
