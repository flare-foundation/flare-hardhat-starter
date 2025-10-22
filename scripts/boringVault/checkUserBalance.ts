/**
 * Example 02: Check User Balance
 *
 * This example shows how to query user-specific data from the vault and teller contracts.
 * No wallet required for reads, but you need a user address to query.
 *
 * You'll learn:
 * - Reading a user's share balance
 * - Checking share unlock time
 * - Calculating ownership percentage
 * - Working with timestamps
 *
 * Run: npx hardhat run scripts/boringVault/checkUserBalance.ts --network coston2
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';

// CONFIGURATION: Replace with the address you want to check
// Default: use the deployer address from the deployment file
let USER_ADDRESS: string | null = null;

async function main() {
  console.log('=== Checking User Balance ===\n');

  // Load deployment addresses
  const addressesPath = './deployment-addresses.json';
  if (!fs.existsSync(addressesPath)) {
    console.error('❌ deployment-addresses.json not found!');
    console.error('Please run: npm run deploy:full');
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  const vaultAddress = deployment.addresses.boringVault;
  const tellerAddress = deployment.addresses.teller;

  // If no user address specified, use deployer address
  if (!USER_ADDRESS) {
    USER_ADDRESS = deployment.deployer;
  }

  console.log(`User Address: ${USER_ADDRESS}`);
  console.log(`Vault Address: ${vaultAddress}\n`);

  try {
    // Step 1: Get contract instances
    const vault = await ethers.getContractAt('BoringVault', vaultAddress);
    const teller = await ethers.getContractAt('TellerWithMultiAssetSupport', tellerAddress);

    // Step 2: Get vault decimals (needed for formatting)
    const decimals = await vault.decimals();
    const symbol = await vault.symbol();

    // Step 3: Get user's share balance
    const balance = await vault.balanceOf(USER_ADDRESS);
    const formattedBalance = ethers.formatUnits(balance, decimals);

    console.log(`Share Balance: ${formattedBalance} ${symbol}`);
    console.log(`Share Balance (raw): ${balance.toString()}\n`);

    // Step 4: Get total supply to calculate ownership percentage
    const totalSupply = await vault.totalSupply();

    // Calculate percentage (handle division by zero)
    let ownershipPercentage = '0.0000';
    if (totalSupply > 0n) {
      // Multiply by 10000 to get basis points, then divide
      const basisPoints = (balance * 10000n) / totalSupply;
      ownershipPercentage = (Number(basisPoints) / 100).toFixed(4);
    }

    console.log(`Ownership: ${ownershipPercentage}% of total supply\n`);

    // Step 5: Check share unlock time from Teller
    const shareUnlockTime = await teller.shareUnlockTime(USER_ADDRESS);

    console.log('=== Share Lock Status ===');
    console.log(`Unlock Timestamp: ${shareUnlockTime.toString()}`);

    // Convert to date
    const unlockDate = new Date(Number(shareUnlockTime) * 1000);
    console.log(`Unlock Date: ${unlockDate.toISOString()}`);

    // Check if shares are currently unlocked
    const currentTime = Math.floor(Date.now() / 1000);
    const isUnlocked = currentTime >= Number(shareUnlockTime);

    if (isUnlocked) {
      console.log('Status: ✅ UNLOCKED - User can withdraw');
    } else {
      const remainingSeconds = Number(shareUnlockTime) - currentTime;
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      console.log(`Status: 🔒 LOCKED - ${hours}h ${minutes}m remaining`);
    }

    // Step 6: Get share lock period configuration
    const shareLockPeriod = await teller.shareLockPeriod();
    console.log(`\nShare Lock Period: ${shareLockPeriod.toString()} seconds`);
    console.log(`(${Number(shareLockPeriod) / 3600} hours)\n`);

    // Step 7: Check if teller is paused
    const isPaused = await teller.isPaused();
    console.log(`Teller Status: ${isPaused ? '⏸️  PAUSED' : '✅ ACTIVE'}`);

    console.log('\n=== Summary ===');
    console.log(`Balance: ${formattedBalance} ${symbol}`);
    console.log(`Ownership: ${ownershipPercentage}%`);
    console.log(`Status: ${isUnlocked ? 'Unlocked' : 'Locked'}`);
    console.log(`Can Withdraw: ${isUnlocked && !isPaused ? 'Yes' : 'No'}`);

    console.log('\n=== Success! ===');
    console.log('You now know how to check user balances and lock status.');
    console.log('Next: Try calculateExchangeRates.ts to work with rates.');

  } catch (error) {
    console.error('\n❌ Error checking user balance:');
    if (error instanceof Error) {
      console.error(error.message);
    }
    console.error('\nTroubleshooting:');
    console.error('1. Check that USER_ADDRESS is a valid Ethereum address');
    console.error('2. Verify contract addresses in deployment-addresses.json');
    console.error('3. Ensure the Coston2 RPC endpoint is accessible');
  }
}

void main().then(() => {
  process.exit(0);
});
