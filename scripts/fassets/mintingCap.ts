import { getAssetManagerFXRP } from "../utils/getters";

// Run with: yarn hardhat run scripts/fassets/mintingCap.ts --network coston2

const IERC20 = artifacts.require("ERC20");

// Agent status constants
const AGENT_STATUS_NORMAL = 0;
const AGENT_STATUS_CCB = 1; // Collateral Call Band

async function main() {
    // ============================================
    // 1. Fetch the FXRP Asset Manager Settings
    // ============================================
    const assetManager = await getAssetManagerFXRP();
    const settings = await assetManager.getSettings();
    
    // Calculate lot size in UBA (Underlying Blockchain Amount)
    const lotSizeUBA = BigInt(settings.lotSizeAMG) * BigInt(settings.assetMintingGranularityUBA);
    
    // Calculate minting cap in UBA
    const mintingCap = BigInt(settings.mintingCapAMG) * BigInt(settings.assetMintingGranularityUBA);
    
    // Get the asset decimals
    const assetDecimals = BigInt(settings.assetDecimals);

    // ============================================
    // 2. Get Current Total FXRP Supply
    // ============================================
    const FXRP = await IERC20.at(settings.fAsset);
    const fxrpDecimals = await FXRP.decimals();
    const totalSupply = BigInt(await FXRP.totalSupply());
    
    const formattedSupply = Number(totalSupply) / Math.pow(10, Number(fxrpDecimals));
    console.log("FAssets FXRP Total Supply:", formattedSupply.toFixed(Number(fxrpDecimals)));

    // Calculate how many lots have been minted
    const mintedLots = totalSupply / lotSizeUBA;
    console.log("FAssets FXRP Minted Lots:", mintedLots.toString());

    // ============================================
    // 3. Calculate Available FXRP Minting Capacity
    // ============================================
    const agents = (await assetManager.getAllAgents(0, 10))._agents;

    let availableToMintLots = 0;
    let totalMintedReservedUBA = BigInt(0);

    // Loop through all agents to calculate available capacity
    for (const agent of agents) {
        const info = await assetManager.getAgentInfo(agent);

        // Track total minted and reserved amounts across all agents
        totalMintedReservedUBA += BigInt(info.mintedUBA) + BigInt(info.reservedUBA);

        // Only count agents that are active and publicly available
        // Status 0 = NORMAL, Status 1 = CCB (Collateral Call Band)
        const isAgentActive = (Number(info.status) === AGENT_STATUS_NORMAL || Number(info.status) === AGENT_STATUS_CCB);
        const isPubliclyAvailable = info.publiclyAvailable === true;
        
        if (isAgentActive && isPubliclyAvailable) {
            availableToMintLots += Number(info.freeCollateralLots);
        }
    }

    // ============================================
    // 4. If FXRP minting cap is set
    // ============================================
    if (mintingCap > 0n) {
        // Calculate remaining capacity under the cap
        const remainingCapacityUBA = mintingCap - totalSupply;
        console.log("\nMinting Cap Analysis:");
        console.log(`Minting Cap: ${mintingCap}`);
        console.log(`Total Supply: ${totalSupply}`);
        
        // Convert remaining capacity to lots
        const remainingCapacityLots = Number(remainingCapacityUBA / lotSizeUBA);
        console.log(`Remaining Capacity (Lots): ${remainingCapacityLots}`);
        
        // The actual available lots is the minimum of:
        // * The remaining capacity under the cap
        // * The free collateral available from agents
        availableToMintLots = Math.min(remainingCapacityLots, availableToMintLots);
    }

    // ============================================
    // 5. Display Results with Progress Bar
    // ============================================
    console.log("\n================================================");
    console.log("MINTING CAPACITY SUMMARY");
    console.log("================================================");
    
    const mintingCapLots = mintingCap / lotSizeUBA;
    console.log(`Minting Cap (Lots): ${mintingCapLots}`);
    
    const formattedMintingCap = Number(mintingCap) / Math.pow(10, Number(assetDecimals));
    console.log(`Minting Cap (FXRP): ${formattedMintingCap}`);
    
    // Calculate usage percentage
    if (mintingCap > 0n) {
        const usedAmount = totalSupply;
        const remainingAmount = mintingCap - totalSupply;
        const usagePercentage = (Number(usedAmount) / Number(mintingCap)) * 100;
        const remainingPercentage = 100 - usagePercentage;
        
        console.log("\n--- Minting Cap Usage ---");
        console.log(`Used:      ${Number(usedAmount) / Math.pow(10, Number(assetDecimals))} FXRP (${usagePercentage.toFixed(2)}%)`);
        console.log(`Remaining: ${Number(remainingAmount) / Math.pow(10, Number(assetDecimals))} FXRP (${remainingPercentage.toFixed(2)}%)`);
        
        // Create visual progress bar
        const barLength = 50;
        const filledLength = Math.round((usagePercentage / 100) * barLength);
        const emptyLength = barLength - filledLength;
        const progressBar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
        
        console.log(`\n[${progressBar}] ${usagePercentage.toFixed(2)}%`);
    } else {
        console.log("\nNo minting cap set (unlimited minting)");
    }
    
    console.log("\n================================================");
    console.log(`Available Lots to Mint: ${availableToMintLots}`);
    console.log("================================================\n");
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
