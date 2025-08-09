import { run } from "hardhat";
import { FtsoV2AnchorFeedConsumerContract } from "../typechain-types";

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
// Format: [0xCC][ASCII(label)][0x00 padding] where CC is category (e.g., 0x01 = Crypto)
function decodeFeedId(idHex: string): { categoryByte: number; category: string; label: string } {
    const hex = idHex.startsWith("0x") ? idHex.slice(2) : idHex;
    const bytes = Buffer.from(hex, "hex");
    if (bytes.length !== 21) return { categoryByte: NaN, category: "Unknown", label: idHex };
    const categoryByte = bytes[0];
    // label is ASCII from index 1 until first 0x00
    let end = bytes.length;
    for (let i = 1; i < bytes.length; i++) {
        if (bytes[i] === 0x00) {
            end = i;
            break;
        }
    }
    const label = bytes.slice(1, end).toString("ascii");
    const category = categoryByte === 0x01 ? "Crypto" : `0x${categoryByte.toString(16).padStart(2, "0")}`;
    return { categoryByte, category, label: label || idHex };
}

/**
 * Fetches anchor feed data from the DA Layer.
 */
async function fetchAnchorFeeds(): Promise<string> {
    // Fetching the anchor feeds from the Data Availability Layer
    // Note: this request will default to the latest voting round id if none is specified
    const daLayerProofsUrl = `${process.env.COSTON2_DA_LAYER_URL}/api/v0/ftso/anchor-feeds-with-proof`;

    try {
        const res = await fetch(daLayerProofsUrl, {
            method: "POST",
            headers: { "x-apikey": process.env.X_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ feed_ids: FEED_IDS }),
        });
        const text = await res.text();
        console.log("DA Layer raw response:", text);
        if (!res.ok) throw new Error(`DA layer returned ${res.status}: ${text}`);
        return text;
    } catch (e) {
        console.error("Error fetching anchor feeds:", e);
        throw e;
    }
}

/**
 * Deploys the FtsoV2AnchorFeedConsumer contract.
 */
async function deployConsumerContract() {
    const FtsoV2AnchorFeedConsumer = await artifacts.require("FtsoV2AnchorFeedConsumer");
    const feedConsumer = await FtsoV2AnchorFeedConsumer.new();
    try {
        await run("verify:verify", {
            address: feedConsumer.address,
            constructorArguments: [],
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log("FtsoV2AnchorFeedConsumer deployed at:", feedConsumer.address);
    return feedConsumer;
}

async function interactWithContract(
    feedConsumer: FtsoV2AnchorFeedConsumerContract,
    feedDataWithProof: FeedDataWithProof
) {
    await feedConsumer.savePrice([
        feedDataWithProof.proof,
        [
            feedDataWithProof.body.votingRoundId,
            feedDataWithProof.body.id,
            feedDataWithProof.body.value,
            feedDataWithProof.body.turnoutBIPS,
            feedDataWithProof.body.decimals,
        ],
    ]);
    const saved = await feedConsumer.provenFeeds(feedDataWithProof.body.votingRoundId, feedDataWithProof.body.id);
    const formattedPrice = Number(saved.value) * Math.pow(10, -Number(saved.decimals));
    const { label, category } = decodeFeedId(feedDataWithProof.body.id);
    console.log(
        `Saved price: ${formattedPrice} ${label} [${category}] at voting round: ${saved.votingRoundId.toString()}`
    );

    console.log("\n\n");
    console.log("Proven feeds:", await feedConsumer.getProvenFeeds(feedDataWithProof.body.votingRoundId));
    console.log("Proven feed ids:", await feedConsumer.getProvenFeedIds(feedDataWithProof.body.votingRoundId));
}

async function main() {
    // Fetch data from the Data Availability Layer
    const rawResponse = await fetchAnchorFeeds();

    // Deploy the consumer contract
    const feedConsumer = await deployConsumerContract();

    // Process each feed
    const feedsFromDALayer = JSON.parse(rawResponse) as any[];
    for (const feed of feedsFromDALayer) {
        const body = feed?.body ?? feed?.data;
        const proof = feed?.proof as string[] | undefined;
        if (!body || !Array.isArray(proof)) {
            console.warn(`Skipping malformed data from DA: ${JSON.stringify(feed)}`);
            continue;
        }

        await interactWithContract(feedConsumer, { proof, body } as FeedDataWithProof);
    }

    process.exit(0);
}

main().catch(e => {
    console.error(e);
});
