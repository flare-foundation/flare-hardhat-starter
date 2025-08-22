import { run, artifacts } from "hardhat";
import { FtsoChainlinkAdapterInstance } from "../../typechain-types";

const FtsoChainlinkAdapter: FtsoChainlinkAdapterInstance = artifacts.require("FtsoChainlinkAdapter");

// --- CONFIGURATION ---
// FTSO Feed ID for BTC / USD
const FTSO_FEED_ID = "0x014254432f55534400000000000000000000000000";
// Decimals to expose via the Chainlink interface (e.g., 8 for BTC/USD)
const CHAINLINK_DECIMALS = 8;
// Description for the adapter
const DESCRIPTION = "FTSOv2 BTC/USD adapted for Chainlink";
// Max age for the price data in seconds (e.g., 1 hour)
const MAX_AGE_SECONDS = 3600;

async function deployAndVerify() {
    const args: any[] = [FTSO_FEED_ID, CHAINLINK_DECIMALS, DESCRIPTION, MAX_AGE_SECONDS];

    console.log("Deploying FtsoChainlinkAdapter with arguments:");
    console.log(`  - FTSO Feed ID: ${args[0]}`);
    console.log(`  - Chainlink Decimals: ${args[1]}`);
    console.log(`  - Description: ${args[2]}`);
    console.log(`  - Max Age (seconds): ${args[3]}`);

    const adapter = (await FtsoChainlinkAdapter.new(...args)) as FtsoChainlinkAdapterInstance;

    console.log("\nFtsoChainlinkAdapter deployed to:", adapter.address);

    try {
        console.log("\nVerifying contract on block explorer...");
        await run("verify:verify", {
            address: adapter.address,
            constructorArguments: args,
        });
        console.log("Verification successful.");
    } catch (e: any) {
        console.error("Verification failed:", e.message);
    }

    return adapter;
}

async function interactWithContract(adapter: FtsoChainlinkAdapterInstance) {
    console.log(`\nInteracting with FtsoChainlinkAdapter at ${adapter.address}`);

    // 1. Read the initial price data
    try {
        const initialData = await adapter.latestRoundData();
        console.log("\n--- Initial State ---");
        logRoundData("Initial cached data", initialData);
    } catch (error: any) {
        if (error.message.includes("NO_DATA")) {
            console.log("\n--- Initial State ---");
            console.log("No data has been cached yet.");
        } else {
            throw error;
        }
    }

    // 2. Refresh the price from the FTSO
    console.log("\n--- Calling refresh() ---");
    console.log("Submitting transaction to update the price from the FTSO...");

    const result = await adapter.refresh();

    console.log(`Refresh transaction successful! Hash: ${result.tx}`);

    const refreshedEvent = result.logs.find((e: any) => e.event === "Refreshed");
    if (refreshedEvent && refreshedEvent.args) {
        console.log("Refreshed Event Details:");
        console.log(`  - Feed ID: ${refreshedEvent.args.feedId}`);
        console.log(`  - Scaled Answer: ${refreshedEvent.args.scaledAnswer.toString()}`);
        console.log(`  - FTSO Timestamp: ${refreshedEvent.args.ftsoTimestamp}`);
    }

    // 3. Read the updated price data
    console.log("\n--- Reading updated price data ---");
    const finalData = await adapter.latestRoundData();
    logRoundData("New cached data", finalData);
}

function logRoundData(label: string, data: any) {
    const roundId = data[0];
    const answer = data[1];
    const startedAt = data[2];
    const updatedAt = data[3];
    const answeredInRound = data[4];

    console.log(`${label}:`);
    console.log(`  - Round ID: ${roundId.toString()}`);
    console.log(`  - Answer: ${answer.toString()}`);
    console.log(`  - Started At: ${new Date(startedAt.toNumber() * 1000).toISOString()}`);
    console.log(`  - Updated At: ${new Date(updatedAt.toNumber() * 1000).toISOString()}`);
    console.log(`  - Answered in Round: ${answeredInRound.toString()}`);
}

async function main() {
    const adapter = await deployAndVerify();
    await interactWithContract(adapter);
}

void main().then(() => {
    process.exit(0);
});
