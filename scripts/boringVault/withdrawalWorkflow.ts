/**
 * Example 05: Withdrawal Workflow
 *
 * This example demonstrates the complete withdrawal workflow.
 *
 * You'll learn:
 * - Checking if shares are unlocked
 * - Calculating expected assets from shares
 * - Applying slippage protection for withdrawals
 * - Executing bulkWithdraw
 *
 * Run: npx hardhat run scripts/boringVault/withdrawalWorkflow.ts --network coston2
 *
 * PREREQUISITE: You must have deposited first (depositWorkflow.ts) and waited for shares to unlock!
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';

// CONFIGURATION
const WITHDRAW_SHARES = '10'; // Amount of shares to withdraw
const WITHDRAW_ASSET_SYMBOL = 'TUSD'; // Which asset to receive
const SLIPPAGE_BPS = 50n; // 0.5% slippage tolerance

async function main() {
  console.log('=== Boring Vault Withdrawal Workflow ===\n');

  // Load deployment
  const addressesPath = './deployment-addresses.json';
  if (!fs.existsSync(addressesPath)) {
    console.error('❌ deployment-addresses.json not found!');
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`Withdrawer: ${signer.address}\n`);

  try {
    // Step 1: Get contract instances
    const vault = await ethers.getContractAt('BoringVault', deployment.addresses.boringVault);
    const teller = await ethers.getContractAt('TellerWithMultiAssetSupport', deployment.addresses.teller);
    const accountant = await ethers.getContractAt('AccountantWithRateProviders', deployment.addresses.accountant);

    // Get asset
    const assetAddressKey = WITHDRAW_ASSET_SYMBOL.toLowerCase();
    const assetAddress = deployment.addresses[assetAddressKey];
    if (!assetAddress) {
      console.error(`❌ Asset ${WITHDRAW_ASSET_SYMBOL} not found`);
      process.exit(1);
    }

    const asset = await ethers.getContractAt('TestERC20', assetAddress);
    const assetDecimals = await asset.decimals();
    const vaultDecimals = await vault.decimals();

    console.log(`Asset: ${WITHDRAW_ASSET_SYMBOL} (${assetAddress})`);
    console.log(`Vault: ${deployment.addresses.boringVault}`);
    console.log(`Teller: ${deployment.addresses.teller}\n`);

    // Step 2: Check share balance
    const shareBalance = await vault.balanceOf(signer.address);
    const withdrawShares = ethers.parseUnits(WITHDRAW_SHARES, vaultDecimals);

    console.log(`Your share balance: ${ethers.formatUnits(shareBalance, vaultDecimals)}`);
    console.log(`Withdraw amount: ${WITHDRAW_SHARES} shares\n`);

    if (shareBalance < withdrawShares) {
      console.error('❌ Insufficient share balance!');
      console.error('Deposit first using: depositWorkflow.ts');
      process.exit(1);
    }

    // Step 3: CRITICAL - Check if shares are unlocked
    console.log('=== Step 1: Check Share Lock Status ===\n');

    const shareUnlockTime = await teller.shareUnlockTime(signer.address);
    const currentTime = Math.floor(Date.now() / 1000);
    const isUnlocked = currentTime >= Number(shareUnlockTime);

    const unlockDate = new Date(Number(shareUnlockTime) * 1000);
    console.log(`Share unlock time: ${unlockDate.toISOString()}`);
    console.log(`Current time: ${new Date().toISOString()}`);

    if (!isUnlocked) {
      const remaining = Number(shareUnlockTime) - currentTime;
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      console.error(`\n❌ Shares are LOCKED for ${hours}h ${minutes}m more!`);
      console.error('You must wait until shares are unlocked to withdraw.');
      process.exit(1);
    }

    console.log('✅ Shares are unlocked!\n');

    // Step 4: Calculate expected assets with slippage
    console.log('=== Step 2: Calculate Expected Assets ===\n');

    const rate = await accountant.getRateInQuote(assetAddress);
    const ONE_SHARE = 10n ** BigInt(vaultDecimals);

    // Formula: assets = (shareAmount * rate) / ONE_SHARE
    const expectedAssets = (withdrawShares * rate) / ONE_SHARE;

    // Apply slippage protection
    const minimumAssets = (expectedAssets * (10000n - SLIPPAGE_BPS)) / 10000n;

    console.log(`Exchange rate: ${ethers.formatUnits(rate, assetDecimals)} ${WITHDRAW_ASSET_SYMBOL}/share`);
    console.log(`Expected assets: ${ethers.formatUnits(expectedAssets, assetDecimals)} ${WITHDRAW_ASSET_SYMBOL}`);
    console.log(`Minimum assets (${Number(SLIPPAGE_BPS) / 100}% slippage): ${ethers.formatUnits(minimumAssets, assetDecimals)}\n`);

    // Step 5: Check if teller is paused
    const isPaused = await teller.isPaused();
    if (isPaused) {
      console.error('❌ Teller is paused! Cannot withdraw.');
      process.exit(1);
    }

    // Step 6: Execute withdrawal
    console.log('=== Step 3: Execute Withdrawal ===\n');

    const assetsBefore = await asset.balanceOf(signer.address);
    const sharesBefore = await vault.balanceOf(signer.address);

    console.log(`Assets before: ${ethers.formatUnits(assetsBefore, assetDecimals)} ${WITHDRAW_ASSET_SYMBOL}`);
    console.log(`Shares before: ${ethers.formatUnits(sharesBefore, vaultDecimals)}`);
    console.log(`Withdrawing ${WITHDRAW_SHARES} shares...`);

    const withdrawTx = await teller.bulkWithdraw(
      assetAddress,
      withdrawShares,
      minimumAssets,
      signer.address
    );

    console.log(`Transaction hash: ${withdrawTx.hash}`);
    const receipt = await withdrawTx.wait();
    console.log(`✅ Withdrawal confirmed in block ${receipt?.blockNumber}\n`);

    // Step 7: Verify result
    console.log('=== Step 4: Verify Result ===\n');

    const assetsAfter = await asset.balanceOf(signer.address);
    const sharesAfter = await vault.balanceOf(signer.address);

    const assetsReceived = assetsAfter - assetsBefore;
    const sharesBurned = sharesBefore - sharesAfter;

    console.log(`Assets after: ${ethers.formatUnits(assetsAfter, assetDecimals)} ${WITHDRAW_ASSET_SYMBOL}`);
    console.log(`Shares after: ${ethers.formatUnits(sharesAfter, vaultDecimals)}`);
    console.log(`\nAssets received: ${ethers.formatUnits(assetsReceived, assetDecimals)} ${WITHDRAW_ASSET_SYMBOL}`);
    console.log(`Shares burned: ${ethers.formatUnits(sharesBurned, vaultDecimals)}`);

    // Calculate actual rate
    const actualRate = (assetsReceived * ONE_SHARE) / sharesBurned;
    console.log(`\nActual rate: ${ethers.formatUnits(actualRate, assetDecimals)} ${WITHDRAW_ASSET_SYMBOL}/share`);

    console.log('\n=== Success! ===');
    console.log(`✅ Withdrew ${WITHDRAW_SHARES} shares`);
    console.log(`✅ Received ${ethers.formatUnits(assetsReceived, assetDecimals)} ${WITHDRAW_ASSET_SYMBOL}`);

  } catch (error: any) {
    console.error('\n❌ Withdrawal failed:');
    if (error.message) {
      console.error(error.message);
    }

    console.error('\nCommon issues:');
    console.error('1. Are your shares unlocked? Check shareUnlockTime');
    console.error('2. Do you have enough shares?');
    console.error('3. Are asset withdrawals enabled? Run: npm run configure:assets');
    console.error('4. Is the exchange rate configured?');
    console.error('5. Check if Teller or Accountant is paused');
  }
}

void main().then(() => {
  process.exit(0);
});
