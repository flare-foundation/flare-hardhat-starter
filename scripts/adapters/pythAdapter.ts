import { run, artifacts } from "hardhat";
import { FtsoPythAdapterInstance } from "../../typechain-types";

const FtsoPythAdapter: FtsoPythAdapterInstance = artifacts.require("FtsoPythAdapter");

// FTSO Feed ID for BTC / USD (bytes21)
const FTSO_FEED_ID = "0x014254432f55534400000000000000000000000000";
// Pyth Price ID for the same feed (bytes32)
// This should be a unique identifier for your adapted feed.
const PYTH_PRICE_ID = "0x4254432f55534400000000000000000000000000000000000000000000000001";
// Description for the adapter
const DESCRIPTION = "FTSOv2 BTC/USD adapted for Pyth";
// Max age for the price data in seconds (e.g., 1 hour) used in getPriceNoOlderThan
const MAX_AGE_SECONDS = 3600;

async function deployAndVerify() {
    const args: any[] = [FTSO_FEED_ID, PYTH_PRICE_ID, DESCRIPTION];

    console.log("Deploying FtsoPythAdapter with arguments:");
    console.log(`  - FTSO Feed ID: ${args[0]}`);
    console.log(`  - Pyth Price ID: ${args[1]}`);
    console.log(`  - Description: ${args[2]}`);

    const adapter = (await FtsoPythAdapter.new(...args)) as FtsoPythAdapterInstance;

    console.log("\nFtsoPythAdapter deployed to:", adapter.address);

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

async function interactWithContract(adapter: FtsoPythAdapterInstance) {
    console.log(`\nInteracting with FtsoPythAdapter at ${adapter.address}`);

    // 1. Read the initial price data using the safe, age-checked function
    try {
        const initialData = await adapter.getPriceNoOlderThan(PYTH_PRICE_ID, MAX_AGE_SECONDS);
        console.log("\n--- Initial State ---");
        logPriceData("Initial cached data", initialData);
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
        console.log(`  - Price ID: ${refreshedEvent.args.priceId}`);
        console.log(`  - Price: ${refreshedEvent.args.price.toString()}`);
        console.log(`  - Expo: ${refreshedEvent.args.expo.toString()}`);
        console.log(`  - Publish Time: ${refreshedEvent.args.publishTime.toString()}`);
    }

    // 3. Read the updated price data
    console.log("\n--- Reading updated price data ---");
    const finalData = await adapter.getPriceNoOlderThan(PYTH_PRICE_ID, MAX_AGE_SECONDS);
    logPriceData("New cached data", finalData);
}

/**
 * Logs the price data from the PythStructs.Price struct in a human-readable format.
 * @param label The label for the price data.
 * @param data The Price struct returned from the contract.
 */
function logPriceData(label: string, data: any) {
    const { price, conf, expo, publishTime } = data;

    const timestamp = typeof publishTime.toNumber === "function" ? publishTime.toNumber() : publishTime;

    console.log(`${label}:`);
    console.log(`  - Price: ${price.toString()}`);
    console.log(`  - Confidence: ${conf.toString()}`);
    console.log(`  - Exponent: ${expo.toString()}`);
    console.log(`  - Publish Time: ${new Date(timestamp * 1000).toISOString()}`);
}

async function main() {
    const adapter = await deployAndVerify();
    await interactWithContract(adapter);
}

void main().then(() => {
    process.exit(0);
});
