import { getAssetManagerFXRP } from "../utils/getters";

// yarn hardhat run scripts/fassets/getRedemptionQueue.ts --network coston2

async function main() {
    
    const assetManager = await getAssetManagerFXRP();
    const settings = await assetManager.getSettings();
    const maxRedeemedTickets = settings.maxRedeemedTickets;
    const lotSizeAMG = settings.lotSizeAMG;

    const redemptionQueueResult = await assetManager.redemptionQueue(0, maxRedeemedTickets);
    const redemptionQueue = redemptionQueueResult._queue;

    // Sum all ticket values in the redemption queue
    const totalValueUBA = redemptionQueue.reduce((sum, ticket) => {
        return sum + BigInt(ticket.ticketValueUBA);
    }, BigInt(0));

    console.log("\nTotal value in redemption queue (UBA):", totalValueUBA.toString());

    // Calculate total lots in the redemption queue
    const totalLots = totalValueUBA / BigInt(lotSizeAMG);
    console.log("\nTotal lots in redemption queue:", totalLots.toString());
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
