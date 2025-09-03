import { artifacts, run } from "hardhat";
import { PythNftMinterInstance, FtsoPythAdapterInstance } from "../../../typechain-types";

// --- Configuration ---
const FtsoPythAdapter: FtsoPythAdapterInstance = artifacts.require("FtsoPythAdapter");
const PythNftMinter: PythNftMinterInstance = artifacts.require("PythNftMinter");

// FTSO Feed ID for BTC / USD (bytes21)
const FTSO_FEED_ID = "0x014254432f55534400000000000000000000000000";
// Pyth Price ID for the same feed (bytes32)
// This should be a unique identifier for your adapted feed.
const PYTH_PRICE_ID = "0x4254432f55534400000000000000000000000000000000000000000000000001";
// Description for the adapter
const DESCRIPTION = "FTSOv2 BTC/USD adapted for Pyth";

/**
 * Deploys and verifies the FtsoPythAdapter and PythNftMinter contracts.
 */
async function deployContracts(): Promise<{ adapter: FtsoPythAdapterInstance; minter: PythNftMinterInstance }> {
    // 1. Deploy the Adapter
    const adapterArgs: any[] = [FTSO_FEED_ID, PYTH_PRICE_ID, DESCRIPTION];
    console.log("Deploying FtsoPythAdapter with arguments:");
    console.log(`  - FTSO Feed ID: ${adapterArgs[0]}`);
    console.log(`  - Pyth Price ID: ${adapterArgs[1]}`);
    console.log(`  - Description: ${adapterArgs[2]}`);

    const adapter = await FtsoPythAdapter.new(...adapterArgs);
    console.log("\nFtsoPythAdapter deployed to:", adapter.address);

    // 2. Deploy the Minter
    const minterArgs: any[] = [adapter.address, PYTH_PRICE_ID];
    console.log("\nDeploying PythNftMinter with arguments:");
    console.log(`  - Adapter Address: ${minterArgs[0]}`);
    console.log(`  - Pyth Price ID: ${minterArgs[1]}`);

    const minter = await PythNftMinter.new(...minterArgs);
    console.log("\nPythNftMinter deployed to:", minter.address);

    // 3. Verify contracts
    try {
        console.log("\nVerifying FtsoPythAdapter on block explorer...");
        await run("verify:verify", {
            address: adapter.address,
            constructorArguments: adapterArgs,
        });
        console.log("Adapter verification successful.");
    } catch (e: any) {
        console.error("Adapter verification failed:", e.message);
    }

    try {
        console.log("\nVerifying PythNftMinter on block explorer...");
        await run("verify:verify", {
            address: minter.address,
            constructorArguments: minterArgs,
        });
        console.log("Minter verification successful.");
    } catch (e: any) {
        console.error("Minter verification failed:", e.message);
    }

    return { adapter, minter };
}

/**
 * Interacts with the deployed contracts to refresh the price and mint an NFT.
 * @param adapter The deployed FtsoPythAdapter instance.
 * @param minter The deployed PythNftMinter instance.
 */
async function interactWithContracts(adapter: FtsoPythAdapterInstance, minter: PythNftMinterInstance) {
    console.log(`\n--- Interacting with FtsoPythAdapter at ${adapter.address} ---`);

    // 1. Refresh the price from the FTSO
    console.log("\nCalling refresh() to update the price from the FTSO...");
    const refreshResult = await adapter.refresh();
    console.log(`Refresh transaction successful! Hash: ${refreshResult.tx}`);

    // 2. Fetch and log the latest price data from the adapter
    const latestPriceData = await adapter.getPriceUnsafe(PYTH_PRICE_ID);
    logFtsoPriceData("Fetched FTSO price data from adapter", latestPriceData);

    // 3. Calculate the required fee and mint the NFT
    console.log(`\n--- Interacting with FtsoNftMinter at ${minter.address} ---`);
    console.log("\nCalculating $1 worth of native token using the refreshed price...");

    const price = BigInt(latestPriceData.price.toString());
    const expo = BigInt(latestPriceData.expo.toString());

    // Perform calculations using BigInt
    const ether = 10n ** 18n;
    const ten = 10n;
    const absoluteExpo = expo < 0n ? -expo : expo; // BigInt absolute value

    const assetPrice18Decimals = (price * ether) / ten ** absoluteExpo;
    const oneDollarInWei = (ether * ether) / assetPrice18Decimals;

    console.log(`Required payment in wei: ${oneDollarInWei.toString()}`);

    console.log("\nSubmitting mint() transaction...");
    const mintResult = await minter.mint({ value: oneDollarInWei.toString() });
    console.log(`NFT minted successfully! Hash: ${mintResult.tx}`);

    const tokenCounter = await minter.getTokenCounter();
    console.log(`Total NFTs minted: ${tokenCounter.toString()}`);
}

/**
 * Logs the FTSO price data from the adapter in a human-readable format.
 * @param label A description for the log output.
 * @param data The Price struct returned from the adapter.
 */
function logFtsoPriceData(label: string, data: any) {
    const { price, expo, publishTime } = data;

    const priceStr = price.toString();
    const expoStr = expo.toString();
    const timestamp = Number(publishTime) * 1000;

    // Calculate the decimal-adjusted price for readability
    const decimalPrice = Number(priceStr) * 10 ** Number(expoStr);

    console.log(`\n${label}:`);
    console.log(`  - Raw Price: ${priceStr}`);
    console.log(`  - Exponent: ${expoStr}`);
    console.log(`  - Adjusted Price: $${decimalPrice.toFixed(4)}`);
    console.log(`  - Publish Time: ${new Date(timestamp).toISOString()}`);
}

async function main() {
    console.log("Starting NFT Minter Management Script");
    const { adapter, minter } = await deployContracts();
    await interactWithContracts(adapter, minter);
    console.log("\nScript finished successfully!");
}

void main()
    .then(() => {
        process.exit(0);
    })
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
