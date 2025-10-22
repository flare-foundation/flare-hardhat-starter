/**
 * Example 07: FTSO Oracle Integration
 *
 * This example demonstrates how to use Flare's FTSO (Flare Time Series Oracle)
 * to provide real-time price feeds for Boring Vault assets.
 *
 * You'll learn:
 * - How FTSO provides decentralized price feeds
 * - Deploying and configuring FTSO rate providers
 * - Comparing pegged vs oracle-based rates
 * - Real-world exchange rate calculations
 *
 * Run: npx hardhat run scripts/boringVault/ftsoOracleIntegration.ts --network coston2
 *
 * PREREQUISITE: Deploy FTSO rate providers first!
 * npm run deploy:ftso-providers
 */

import { ethers } from "hardhat";
import { ContractRegistry, coston2 } from "@flarenetwork/flare-periphery-contract-artifacts";

// Get the Flare Contract Registry instance
async function getFlareContractRegistry() {
    const [signer] = await ethers.getSigners();
    return new ethers.Contract(ContractRegistry, coston2.interfaceAbis.IFlareContractRegistry, signer);
}

// Get FTSO Registry contract instance
async function getFtsoRegistry() {
    const registry = await getFlareContractRegistry();
    const ftsoRegistryAddress = await registry.getContractAddressByName("FtsoRegistry");

    const ftsoRegistryAbi = coston2.nameToAbi("FtsoRegistry");
    if (!ftsoRegistryAbi) {
        throw new Error("Could not find ABI for FtsoRegistry on coston2");
    }

    const [signer] = await ethers.getSigners();
    return new ethers.Contract(ftsoRegistryAddress, ftsoRegistryAbi, signer);
}

// Fetch and display prices from FTSO
async function demonstrateFtsoPrices(ftsoRegistry: any) {
    console.log("=== Step 1: Fetch Prices from FTSO ===\n");

    const symbols = ["BTC", "ETH", "FLR"];

    for (const symbol of symbols) {
        try {
            const [price, timestamp, decimals] = await ftsoRegistry.getCurrentPriceWithDecimals(symbol);

            const formattedPrice = ethers.formatUnits(price, decimals);
            const priceAge = Math.floor(Date.now() / 1000) - Number(timestamp);
            const lastUpdate = new Date(Number(timestamp) * 1000);

            console.log(`${symbol}/USD:`);
            console.log(`  Price: $${formattedPrice}`);
            console.log(`  Decimals: ${decimals}`);
            console.log(`  Last Update: ${lastUpdate.toISOString()}`);
            console.log(`  Age: ${priceAge} seconds ago`);
            console.log(`  Status: ${priceAge < 300 ? "✅ Fresh" : "⚠️  Stale"}\n`);
        } catch (error: any) {
            console.log(`${symbol}/USD: ⚠️  Not available on testnet\n`);
        }
    }
}

// Compare pegged vs oracle-based rates
async function compareRateApproaches(ftsoRegistry: any) {
    console.log("=== Step 2: Pegged vs Oracle-Based Rates ===\n");

    console.log("Scenario: User wants to deposit 1 WETH");
    console.log("Base Asset: TUSD (USD-pegged stablecoin)\n");

    console.log("❌ Current Approach (Pegged 1:1):");
    console.log("   1 WETH = 1 TUSD = $1.00");
    console.log("   User receives: 1 share");
    console.log("   Problem: Ignores real ETH market price!\n");

    try {
        const [ethPrice, , ethDecimals] = await ftsoRegistry.getCurrentPriceWithDecimals("ETH");
        const formattedEthPrice = ethers.formatUnits(ethPrice, ethDecimals);

        console.log("✅ Oracle Approach (FTSO):");
        console.log(`   1 WETH = $${formattedEthPrice} (live market price)`);
        console.log(`   User receives: ${formattedEthPrice} shares`);
        console.log("   Benefit: Accurate pricing based on real markets!\n");
    } catch (error) {
        console.log("✅ Oracle Approach (FTSO):");
        console.log("   Would fetch live ETH/USD price from FTSO");
        console.log("   (Not available on this testnet)\n");
    }
}

// Display deployment instructions
function showDeploymentGuide() {
    console.log("=== Step 3: Deploy FTSO Rate Provider ===\n");

    console.log("To deploy a rate provider for WETH using FTSOv2:");
    console.log("");
    console.log("```typescript");
    console.log("// Get the FTSOv2 feed ID for ETH/USD");
    console.log('const feedIdConverter = await registry.getContractAddressByName("FtsoFeedIdConverter");');
    console.log("const converter = new ethers.Contract(feedIdConverter, converterAbi, signer);");
    console.log('const ethFeedId = await converter.getFeedId(1, "ETH"); // Category 1 = Crypto');
    console.log("");
    console.log('const FTSORateProvider = await ethers.getContractFactory("FTSORateProvider");');
    console.log("const wethRateProvider = await FTSORateProvider.deploy(");
    console.log("  ethFeedId,                    // Feed ID (bytes21)");
    console.log("  18,                           // Rate decimals (match base)");
    console.log("  300                           // 5 min staleness check");
    console.log(");");
    console.log("```\n");
}

// Display configuration guide
function showConfigurationGuide() {
    console.log("=== Step 4: Configure Accountant ===\n");

    console.log("After deploying rate providers, configure them:");
    console.log("");
    console.log("```typescript");
    console.log("// Set WETH to use FTSO oracle");
    console.log("await accountant.setRateProviderData(");
    console.log("  WETH_ADDRESS,");
    console.log("  false,                    // NOT pegged to base");
    console.log("  wethRateProvider.address  // Use FTSO oracle");
    console.log(");");
    console.log("");
    console.log("// Set WBTC to use FTSO oracle");
    console.log("await accountant.setRateProviderData(");
    console.log("  WBTC_ADDRESS,");
    console.log("  false,                    // NOT pegged to base");
    console.log("  wbtcRateProvider.address  // Use FTSO oracle");
    console.log(");");
    console.log("```\n");
}

// Show exchange rate calculation example
function showExchangeRateExample() {
    console.log("=== Step 5: Exchange Rate Calculation ===\n");

    console.log("With Oracle Integration:");
    console.log("");
    console.log("1. User deposits 1 WETH");
    console.log("2. Accountant calls wethRateProvider.getRate()");
    console.log("3. Rate provider queries FTSO for ETH/USD price");
    console.log("4. FTSO returns: $3,500 (example)");
    console.log("5. Formula: shares = (1 WETH * 3500 USD/ETH) / (1 USD/share)");
    console.log("6. User receives: 3,500 shares\n");

    console.log("Benefits:");
    console.log("✅ Accurate pricing based on market rates");
    console.log("✅ Decentralized price feeds (no single point of failure)");
    console.log("✅ Updated every block by FTSO");
    console.log("✅ Staleness protection (reverts if price too old)");
    console.log("✅ No need for manual rate updates\n");
}

// Display FTSO advantages
function showFtsoAdvantages() {
    console.log("=== Step 6: Why Flare FTSO? ===\n");

    console.log("Compared to other oracles:");
    console.log("");
    console.log("📊 Chainlink:");
    console.log("   - Centralized data providers");
    console.log("   - May not be available on all networks");
    console.log("   - Requires LINK token fees");
    console.log("");
    console.log("🌟 Flare FTSO:");
    console.log("   - Decentralized (70+ independent providers)");
    console.log("   - Native to Flare/Coston2");
    console.log("   - NO fees - completely free!");
    console.log("   - Block update frequency");
    console.log("   - Covers major pairs: BTC, ETH, FLR, XRP, etc.\n");
}

// Display production checklist
function showProductionChecklist() {
    console.log("=== Step 7: Production Deployment Checklist ===\n");

    console.log("[ ] 1. Deploy FTSO rate providers for each asset");
    console.log("[ ] 2. Configure Accountant with rate providers");
    console.log("[ ] 3. Test rate fetching works correctly");
    console.log("[ ] 4. Verify staleness checks trigger appropriately");
    console.log("[ ] 5. Set up monitoring for price feed health");
    console.log("[ ] 6. Create automated bot to call updateExchangeRate()");
    console.log("[ ] 7. Test with small deposits first");
    console.log("[ ] 8. Monitor for any price deviation issues\n");
}

// Display success message
function showSuccessMessage() {
    console.log("=== Success! ===");
    console.log("You now understand how to integrate FTSO oracles!");
    console.log("");
    console.log("Next Steps:");
    console.log("1. Deploy rate providers: npm run deploy:ftso-providers");
    console.log("2. Configure your deployed vault to use them");
    console.log("3. Test deposits with real market prices\n");
}

// Main function
async function main() {
    console.log("=== FTSO Oracle Integration Example ===\n");

    const [signer] = await ethers.getSigners();
    console.log(`User: ${signer.address}\n`);

    try {
        const ftsoRegistry = await getFtsoRegistry();
        const registry = await getFlareContractRegistry();
        const ftsoRegistryAddress = await registry.getContractAddressByName("FtsoRegistry");
        console.log(`FtsoRegistry contract address: ${ftsoRegistryAddress}\n`);

        await demonstrateFtsoPrices(ftsoRegistry);
        await compareRateApproaches(ftsoRegistry);
        showDeploymentGuide();
        showConfigurationGuide();
        showExchangeRateExample();
        showFtsoAdvantages();
        showProductionChecklist();
        showSuccessMessage();
    } catch (error: any) {
        console.error("\n❌ Error:");
        if (error.message) {
            console.error(error.message);
        }
        console.error("\nNote: Some features may not work on testnets");
        console.error("FTSO may not have all price feeds available");
    }
}

void main().then(() => {
    process.exit(0);
});
