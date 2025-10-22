/**
 * Example 03: Calculate Exchange Rates
 *
 * This example demonstrates how to work with the Accountant contract to fetch
 * exchange rates and perform share/asset conversions.
 *
 * You'll learn:
 * - Fetching exchange rates from the Accountant
 * - Converting assets to shares (for deposits)
 * - Converting shares to assets (for withdrawals)
 * - Handling different asset decimals
 * - The math behind rate calculations
 *
 * Run: npx hardhat run scripts/boringVault/calculateExchangeRates.ts --network coston2
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';

// Asset configuration from deployment
interface AssetInfo {
  address: string;
  symbol: string;
  decimals: number;
}

// Load deployment addresses from file
function loadDeploymentAddresses() {
  const addressesPath = './deployment-addresses.json';
  if (!fs.existsSync(addressesPath)) {
    console.error('❌ deployment-addresses.json not found!');
    console.error('Please run: npm run deploy:full');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
}

// Get vault and accountant contracts
async function getContracts(deployment: any) {
  const vaultAddress = deployment.addresses.boringVault;
  const accountantAddress = deployment.addresses.accountant;

  console.log(`Vault: ${vaultAddress}`);
  console.log(`Accountant: ${accountantAddress}\n`);

  const vault = await ethers.getContractAt('BoringVault', vaultAddress);
  const accountant = await ethers.getContractAt('AccountantWithRateProviders', accountantAddress);

  return { vault, accountant };
}

// Get base asset information
async function getBaseAssetInfo(accountant: any) {
  const baseAssetAddress = await accountant.base();
  console.log(`Base Asset: ${baseAssetAddress}`);

  const baseAsset = await ethers.getContractAt('TestERC20', baseAssetAddress);
  const baseSymbol = await baseAsset.symbol();
  const baseDecimals = await baseAsset.decimals();
  console.log(`Base Asset Symbol: ${baseSymbol} (${baseDecimals} decimals)\n`);

  return { baseAssetAddress, baseSymbol, baseDecimals };
}

// Display exchange rates for all assets
async function displayExchangeRates(accountant: any, assets: AssetInfo[], vaultDecimals: number) {
  console.log('=== Exchange Rates ===\n');

  for (const asset of assets) {
    console.log(`Asset: ${asset.symbol} (${asset.address})`);

    try {
      const rateInQuote = await accountant.getRateInQuote(asset.address);
      const formattedRate = ethers.formatUnits(rateInQuote, asset.decimals);
      console.log(`Rate: ${formattedRate} ${asset.symbol} per share`);
      console.log(`Rate (raw): ${rateInQuote.toString()}\n`);

      // Example calculations
      console.log(`  Example Conversions:`);

      const ONE_SHARE = 10n ** BigInt(vaultDecimals);

      // 1. Asset to Shares (used for deposits)
      const assetAmount = ethers.parseUnits('100', asset.decimals);
      const expectedShares = (assetAmount * ONE_SHARE) / rateInQuote;
      const formattedShares = ethers.formatUnits(expectedShares, vaultDecimals);
      console.log(`  100 ${asset.symbol} → ${formattedShares} shares`);

      // 2. Shares to Assets (used for withdrawals)
      const shareAmount = ethers.parseUnits('10', vaultDecimals);
      const expectedAssets = (shareAmount * rateInQuote) / ONE_SHARE;
      const formattedAssets = ethers.formatUnits(expectedAssets, asset.decimals);
      console.log(`  10 shares → ${formattedAssets} ${asset.symbol}\n`);
    } catch (err) {
      console.log(`  ⚠️  Rate not configured for ${asset.symbol}\n`);
    }
  }
}

// Explain ONE_SHARE concept
function explainOneShare(vaultDecimals: number) {
  console.log('=== Understanding ONE_SHARE ===\n');
  const ONE_SHARE = 10n ** BigInt(vaultDecimals);
  console.log(`ONE_SHARE = 10^${vaultDecimals} = ${ONE_SHARE.toString()}`);
  console.log(`This represents 1.0 full share in the contract's internal representation.\n`);

  console.log('Why is this important?');
  console.log('- All rate calculations use ONE_SHARE as the base unit');
  console.log('- The rate tells you how many quote assets equal ONE_SHARE');
  console.log('- Always multiply by ONE_SHARE then divide by rate (or vice versa)');
  console.log('- Never use floating point - always use BigInt arithmetic!\n');
}

// Demonstrate slippage protection
async function demonstrateSlippage(accountant: any, asset: AssetInfo, vaultDecimals: number) {
  console.log('=== Slippage Protection ===\n');

  const depositAmount = ethers.parseUnits('1000', asset.decimals);
  const ONE_SHARE = 10n ** BigInt(vaultDecimals);

  try {
    const rate = await accountant.getRateInQuote(asset.address);
    const expectedShares = (depositAmount * ONE_SHARE) / rate;

    // Calculate minimum shares with 0.5% slippage tolerance
    const slippageBps = 50n; // 50 basis points = 0.5%
    const minimumShares = (expectedShares * (10000n - slippageBps)) / 10000n;

    console.log(`Depositing: ${ethers.formatUnits(depositAmount, asset.decimals)} ${asset.symbol}`);
    console.log(`Expected shares: ${ethers.formatUnits(expectedShares, vaultDecimals)}`);
    console.log(`Minimum shares (0.5% slippage): ${ethers.formatUnits(minimumShares, vaultDecimals)}`);
    console.log(`\nThe transaction will revert if you receive less than the minimum.`);
  } catch (err) {
    console.log(`⚠️  Rate not configured yet. Run: npm run configure:assets`);
  }
}

// Main function
async function main() {
  console.log('=== Calculate Exchange Rates ===\n');

  try {
    const deployment = loadDeploymentAddresses();
    const { vault, accountant } = await getContracts(deployment);

    // Get vault decimals
    const vaultDecimals = await vault.decimals();
    console.log(`Vault Decimals: ${vaultDecimals}\n`);

    // Get base asset info
    await getBaseAssetInfo(accountant);

    // Define assets from deployment
    const assets: AssetInfo[] = [
      { address: deployment.addresses.tusd, symbol: 'TUSD', decimals: 18 },
      { address: deployment.addresses.usdc, symbol: 'USDC', decimals: 6 },
      { address: deployment.addresses.weth, symbol: 'WETH', decimals: 18 },
      { address: deployment.addresses.wbtc, symbol: 'WBTC', decimals: 8 },
      { address: deployment.addresses.wc2flr, symbol: 'WC2FLR', decimals: 18 },
    ];

    await displayExchangeRates(accountant, assets, vaultDecimals);
    explainOneShare(vaultDecimals);
    await demonstrateSlippage(accountant, assets[0], vaultDecimals);

    console.log('\n=== Success! ===');
    console.log('You now understand exchange rate calculations!');
    console.log('Next: Try depositWorkflow.ts to perform a real deposit.');
  } catch (error) {
    console.error('\n❌ Error calculating exchange rates:');
    if (error instanceof Error) {
      console.error(error.message);
    }
    console.error('\nTroubleshooting:');
    console.error('1. Verify the Accountant contract address is correct');
    console.error('2. Ensure assets are properly configured in the Accountant');
    console.error('3. Check that rate providers are set up correctly');
    console.error('4. Run: npm run configure:assets');
  }
}

void main().then(() => {
  process.exit(0);
});
