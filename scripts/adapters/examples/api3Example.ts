import { artifacts, run, web3 } from "hardhat";
import { PriceGuesserInstance, FtsoApi3AdapterInstance } from "../../../typechain-types";

// --- Configuration ---
const FtsoApi3Adapter: FtsoApi3AdapterInstance = artifacts.require("FtsoApi3Adapter");
const PriceGuesser: PriceGuesserInstance = artifacts.require("PriceGuesser");

// FTSO Feed ID for FLR / USD (bytes21) on the Coston2 network.
const FTSO_FEED_ID = "0x01464c522f55534400000000000000000000000000";
// A human-readable description for the price feed adapter.
const DESCRIPTION = "FTSOv2 FLR/USD adapted for API3";
// A staleness check; the adapter will revert if the price hasn't been refreshed in this many seconds.
const MAX_AGE_SECONDS = 3600; // 1 hour

// Prediction Market Configuration
const STRIKE_PRICE_USD = 0.025; // The target price to bet against: $0.025
const ROUND_DURATION_SECONDS = 300; // 5 minutes for the betting round

// --- Helper Function to wait for a specified time ---
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Deploys and verifies the FtsoApi3Adapter and PriceGuesser contracts.
 */
async function deployContracts(): Promise<{ adapter: FtsoApi3AdapterInstance; guesser: PriceGuesserInstance }> {
    // 1. Deploy the Adapter
    const adapterArgs: any[] = [FTSO_FEED_ID, DESCRIPTION, MAX_AGE_SECONDS];
    console.log("Deploying FtsoApi3Adapter with arguments:");
    console.log(`  - FTSO Feed ID: ${adapterArgs[0]}`);
    console.log(`  - Description: ${adapterArgs[1]}`);
    console.log(`  - Max Age (seconds): ${adapterArgs[2]}`);

    const adapter = await FtsoApi3Adapter.new(...adapterArgs);
    console.log("\n✅ FtsoApi3Adapter deployed to:", adapter.address);

    // 2. Deploy the PriceGuesser, linking it to the adapter
    const strikePriceWei = BigInt(STRIKE_PRICE_USD * 1e18);
    const guesserArgs: any[] = [adapter.address, strikePriceWei.toString(), ROUND_DURATION_SECONDS];
    console.log("\nDeploying PriceGuesser with arguments:");
    console.log(`  - Price Feed Address: ${guesserArgs[0]}`);
    console.log(`  - Strike Price: $${STRIKE_PRICE_USD} (${guesserArgs[1]} wei)`);
    console.log(`  - Round Duration: ${guesserArgs[2]} seconds`);

    const guesser = await PriceGuesser.new(...guesserArgs);
    console.log("\n✅ PriceGuesser deployed to:", guesser.address);

    // 3. Verification on a live network
    try {
        console.log("\nVerifying FtsoApi3Adapter on block explorer...");
        await run("verify:verify", {
            address: adapter.address,
            constructorArguments: adapterArgs,
        });
        console.log("Adapter verification successful.");
    } catch (e: any) {
        console.error("Adapter verification failed:", e.message);
    }

    try {
        console.log("\nVerifying PriceGuesser on block explorer...");
        await run("verify:verify", {
            address: guesser.address,
            constructorArguments: guesserArgs,
        });
        console.log("PriceGuesser verification successful.");
    } catch (e: any) {
        console.error("PriceGuesser verification failed:", e.message);
    }

    return { adapter, guesser };
}

/**
 * Simulates a full prediction market round with multiple participants.
 */
async function interactWithMarket(adapter: FtsoApi3AdapterInstance, guesser: PriceGuesserInstance) {
    const accounts = await web3.eth.getAccounts();
    const deployer = accounts[0];
    // Use a second account if available, otherwise reuse the deployer
    const bettorAbove = accounts[1] || deployer;
    const bettorBelow = accounts[2] || deployer;

    const betAmountAbove = 10n * 10n ** 18n; // 10 native tokens
    const betAmountBelow = 20n * 10n ** 18n; // 20 native tokens

    console.log(`\n--- Simulating Prediction Market ---`);
    console.log(`  - Deployer/Settler: ${deployer}`);
    console.log(`  - Bettor "Above": ${bettorAbove}`);
    console.log(`  - Bettor "Below": ${bettorBelow}`);

    // Step 1: Place bets
    console.log("\nStep 1: Bettors are placing their bets...");
    await guesser.betAbove({ from: bettorAbove, value: betAmountAbove.toString() });
    console.log(`  - BettorAbove placed ${web3.utils.fromWei(betAmountAbove.toString())} tokens in the 'Above' pool.`);
    await guesser.betBelow({ from: bettorBelow, value: betAmountBelow.toString() });
    console.log(`  - BettorBelow placed ${web3.utils.fromWei(betAmountBelow.toString())} tokens in the 'Below' pool.`);

    // Step 2: Wait for the betting round to end in real-time
    console.log(`\nStep 2: Betting round is live. Waiting ${ROUND_DURATION_SECONDS} seconds for it to expire...`);
    await wait(ROUND_DURATION_SECONDS * 1000);
    console.log("  - The betting round has now expired.");

    // Step 3: Refresh the oracle price
    console.log("\nStep 3: Refreshing the FTSO price on the adapter post-expiry...");
    await adapter.refresh({ from: deployer });
    console.log("  - Adapter price has been updated.");

    // Step 4: Settle the market
    console.log("\nStep 4: Settling the prediction market...");
    const settleTx = await guesser.settle({ from: deployer });
    const settledEvent = settleTx.logs.find(e => e.event === "MarketSettled");
    const finalPrice = BigInt(settledEvent.args.finalPrice.toString());
    const outcome = Number(settledEvent.args.outcome); // 0=Unsettled, 1=Above, 2=Below

    const finalPriceFormatted = Number(finalPrice / 10n ** 14n) / 10000;
    console.log(`✅ Market settled! Final Price: $${finalPriceFormatted.toFixed(4)}`);
    console.log(`✅ Outcome: The price was ${outcome === 1 ? "ABOVE" : "BELOW"} the strike price.`);

    // Step 5: Claim winnings
    console.log("\nStep 5: Distributing winnings...");
    const [winner, loser] = outcome === 1 ? [bettorAbove, bettorBelow] : [bettorBelow, bettorAbove];
    const prizePool = outcome === 1 ? betAmountBelow : betAmountAbove;
    const winnerBet = outcome === 1 ? betAmountAbove : betAmountBelow;

    // It's possible for the winner to have no one to claim winnings from if the other pool is empty
    if (prizePool > 0n) {
        const expectedWinnings = winnerBet + prizePool;
        console.log(`  - Attempting to claim for WINNER (${winner === bettorAbove ? '"Above"' : '"Below"'})`);
        await guesser.claimWinnings({ from: winner });
        console.log(`  - WINNER claimed their prize of ${web3.utils.fromWei(expectedWinnings.toString())} tokens.`);
    } else {
        console.log("  - WINNER's pool won, but the losing pool was empty. No profits to claim.");
    }

    // Demonstrate that losers cannot claim
    try {
        await guesser.claimWinnings({ from: loser });
    } catch (error: any) {
        if (error.message.includes("NothingToClaim")) {
            console.log("  - LOSER correctly failed to claim winnings.");
        } else {
            console.error("  - An unexpected error occurred for the loser:", error.message);
        }
    }
}

async function main() {
    console.log("🚀 Starting Prediction Market Management Script 🚀");
    const { adapter, guesser } = await deployContracts();
    await interactWithMarket(adapter, guesser);
    console.log("\n🎉 Script finished successfully! 🎉");
}

void main()
    .then(() => {
        process.exit(0);
    })
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
