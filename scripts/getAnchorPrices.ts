import { Contract } from "ethers";
import { initializeFtsoV2Contract, getDALayerUrl, getCurrentNetworkNamespace } from "../utils/network";
import hre from "hardhat";

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

async function verifyFeedDataOnChain(ftsoV2Contract: Contract | any, feedDataWithProof: any): Promise<boolean> {
    try {
        if (!feedDataWithProof || !feedDataWithProof.body || !feedDataWithProof.proof) {
            console.error(`Invalid feed data structure for verification:`, feedDataWithProof);
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
    const apiKey = process.env.FLARE_API_KEY;
    if (!apiKey) {
        throw new Error("FLARE_API_KEY environment variable is required but not set.");
    }

    const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "x-apikey": apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            feed_ids: [feedId],
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP error! Status: ${response.status} for feed_id: ${feedId}. Body: ${errorBody}`);
    }

    const responseData = await response.json();
    if (!Array.isArray(responseData) || responseData.length === 0) {
        throw new Error(`Unexpected response format or empty data for feed_id: ${feedId}`);
    }
    return responseData[0];
}

// Helper function to fetch feed IDs
async function fetchFeedIds(apiUrlFeedNames: string): Promise<string[]> {
    const apiKey = process.env.FLARE_API_KEY;
    if (!apiKey) {
        throw new Error("FLARE_API_KEY environment variable is required but not set.");
    }

    const response = await fetch(apiUrlFeedNames, {
        headers: {
            "x-apikey": apiKey,
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP error fetching feed names! Status: ${response.status}. Body: ${errorBody}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
        throw new Error(
            `Unexpected response format when fetching feed names. Expected array, got: ${JSON.stringify(data)}`
        );
    }
    return data.map((item: any) => item.feed_id);
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

            await delay(500);
        } catch (error: any) {
            console.error(`Failed to process feed ${feedId}:`, error.message);
            verificationResults.push({
                feedId,
                isValid: false,
                data: null,
                error: error.message,
            });
            await delay(500);
        }
    }

    return {
        responses: allResponses,
        verifications: verificationResults,
    };
}

async function main() {
    try {
        // 1. Get Network Configuration
        const currentNetworkNamespace = await getCurrentNetworkNamespace();
        const networkName = hre.network.name;
        const daLayerUrl = getDALayerUrl(networkName);

        // 2. Define API URLs
        const apiUrlFeedNames = `${daLayerUrl}/api/v0/ftso/anchor-feed-names`;
        const apiUrlGetProofs = `${daLayerUrl}/api/v0/ftso/anchor-feeds-with-proof`;

        // 3. Initialize FTSO V2 Contract
        const ftsoV2Contract = await initializeFtsoV2Contract(currentNetworkNamespace);

        // 4. Fetch Feed IDs
        const feedIds = await fetchFeedIds(apiUrlFeedNames);

        // 5. Process Price Feeds (Fetch Proofs and Verify)
        const priceDataResult = await processPriceFeeds(ftsoV2Contract, apiUrlGetProofs, feedIds);

        // 6. Log Results
        console.log("Price Data Fetch and Verification Complete:");
        console.log(JSON.stringify(priceDataResult, null, 2));
    } catch (error: any) {
        console.error(`Error in main execution:`, error);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
