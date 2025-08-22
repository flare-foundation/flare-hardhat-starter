import { run, artifacts } from "hardhat";
import { FtsoApi3AdapterInstance } from "../../typechain-types";

const FtsoApi3Adapter: FtsoApi3AdapterInstance = artifacts.require("FtsoApi3Adapter");

// --- CONFIGURATION ---
// FTSO Feed ID for BTC / USD or substitute any FTSO feed ID
const FTSO_FEED_ID = "0x014254432f55534400000000000000000000000000";
// Description for the adapter
const DESCRIPTION = "FTSOv2 BTC/USD adapted for API3";
// Max age for the price data in seconds (e.g., 1 hour)
const MAX_AGE_SECONDS = 3600;

async function deployAndVerify() {
    const args: any[] = [FTSO_FEED_ID, DESCRIPTION, MAX_AGE_SECONDS];

    console.log("Deploying FtsoApi3Adapter with arguments:");
    console.log(`  - FTSO Feed ID: ${args[0]}`);
    console.log(`  - Description: ${args[1]}`);
    console.log(`  - Max Age (seconds): ${args[2]}`);

    const adapter: FtsoApi3AdapterInstance = await FtsoApi3Adapter.new(...args);

    console.log("FtsoApi3Adapter deployed to:", adapter.address);

    try {
        console.log("Verifying contract on block explorer...");
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

async function interactWithContract(adapter: FtsoApi3AdapterInstance) {
    console.log(`Interacting with FtsoApi3Adapter at ${adapter.address}`);

    // 1. Read the initial price
    try {
        const initialRead = await adapter.read();
        const initialValue = initialRead[0];
        const initialTimestamp = initialRead[1];
        console.log("\n--- Initial State ---");
        if (initialTimestamp.toNumber() === 0) {
            console.log("No data has been cached yet.");
        } else {
            logPrice("Initial cached price", initialValue, initialTimestamp);
        }
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

    // Find and log the Refreshed event
    const refreshedEvent = result.logs.find((e: any) => e.event === "Refreshed");
    if (refreshedEvent && refreshedEvent.args) {
        console.log("Refreshed Event Details:");
        console.log(`  - Feed ID: ${refreshedEvent.args.feedId}`);
        console.log(`  - Scaled Value (int224): ${refreshedEvent.args.scaledValue.toString()}`);
        console.log(`  - Timestamp: ${refreshedEvent.args.timestamp}`);
    }

    // 3. Read the updated price
    console.log("\n--- Reading updated price ---");
    const finalRead = await adapter.read();
    const finalValue = finalRead[0];
    const finalTimestamp = finalRead[1];
    logPrice("New cached price", finalValue, finalTimestamp);
}

function logPrice(label: string, value: any, timestamp: any) {
    const date = new Date(timestamp.toNumber() * 1000); // Convert Unix timestamp to JS Date
    // API3 adapter scales to 18 decimals
    const formattedValue = value.toString();

    console.log(`${label}:`);
    console.log(`  - Value (scaled to 18 decimals): ${formattedValue}`);
    console.log(`  - Timestamp: ${timestamp.toNumber()} (${date.toUTCString()})`);
}

async function main() {
    const adapter = await deployAndVerify();
    await interactWithContract(adapter);
}

void main().then(() => {
    process.exit(0);
});
