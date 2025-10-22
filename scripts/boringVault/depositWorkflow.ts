/**
 * Example 04: Deposit Workflow
 *
 * This example demonstrates the complete deposit workflow, including:
 * - Token approval (CRITICAL: approve VAULT, not Teller!)
 * - Exchange rate fetching
 * - Slippage calculation
 * - Deposit execution
 *
 * You'll learn:
 * - Why you must approve the vault address
 * - How to calculate minimum shares with slippage
 * - Complete deposit transaction flow
 * - Verifying the result
 *
 * Run: npx hardhat run scripts/boringVault/depositWorkflow.ts --network coston2
 *
 * IMPORTANT: Make sure you have test tokens!
 * Get tokens: Run contract.faucet() on any test token, or use npm run wrap:c2flr
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

// CONFIGURATION
const DEPOSIT_AMOUNT = '100'; // Amount to deposit (in token units)
const ASSET_SYMBOL = 'TUSD'; // Which asset to deposit
const SLIPPAGE_BPS = 50n; // 0.5% slippage tolerance

async function main() {
  console.log('=== Boring Vault Deposit Workflow ===\n');

  // Load deployment
  const addressesPath = './deployment-addresses.json';
  if (!fs.existsSync(addressesPath)) {
    console.error('❌ deployment-addresses.json not found!');
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`Depositor: ${signer.address}\n`);

  try {
    // Step 1: Get contract instances
    const vault = await ethers.getContractAt('BoringVault', deployment.addresses.boringVault);
    const teller = await ethers.getContractAt('TellerWithMultiAssetSupport', deployment.addresses.teller);
    const accountant = await ethers.getContractAt('AccountantWithRateProviders', deployment.addresses.accountant);

    // Get asset address by symbol
    const assetAddressKey = ASSET_SYMBOL.toLowerCase();
    const assetAddress = deployment.addresses[assetAddressKey];
    if (!assetAddress) {
      console.error(`❌ Asset ${ASSET_SYMBOL} not found in deployment`);
      process.exit(1);
    }

    const asset = await ethers.getContractAt('TestERC20', assetAddress);
    const assetDecimals = await asset.decimals();
    const vaultDecimals = await vault.decimals();

    console.log(`Asset: ${ASSET_SYMBOL} (${assetAddress})`);
    console.log(`Vault: ${deployment.addresses.boringVault}`);
    console.log(`Teller: ${deployment.addresses.teller}\n`);

    // Step 2: Check user's asset balance
    const userBalance = await asset.balanceOf(signer.address);
    const depositAmount = ethers.parseUnits(DEPOSIT_AMOUNT, assetDecimals);

    console.log(`Your ${ASSET_SYMBOL} balance: ${ethers.formatUnits(userBalance, assetDecimals)}`);
    console.log(`Deposit amount: ${DEPOSIT_AMOUNT} ${ASSET_SYMBOL}\n`);

    if (userBalance < depositAmount) {
      console.error(`❌ Insufficient balance!`);
      console.error(`Get tokens by calling: await ${ASSET_SYMBOL}.faucet()`);
      process.exit(1);
    }

    // Step 3: CRITICAL - Check allowance for VAULT (not Teller!)
    console.log('=== Step 1: Token Approval ===\n');
    const vaultAddress = await vault.getAddress();
    const currentAllowance = await asset.allowance(signer.address, vaultAddress);

    console.log(`Current allowance (Vault): ${ethers.formatUnits(currentAllowance, assetDecimals)}`);

    if (currentAllowance < depositAmount) {
      console.log(`⚠️  Insufficient allowance. Approving vault...\n`);

      // CRITICAL: Approve the VAULT, not the Teller!
      // The vault's enter() function calls transferFrom()
      const approveTx = await asset.approve(vaultAddress, depositAmount);
      console.log(`Approval transaction: ${approveTx.hash}`);
      await approveTx.wait();
      console.log(`✅ Approval confirmed\n`);
    } else {
      console.log(`✅ Sufficient allowance already set\n`);
    }

    // Step 4: Calculate expected shares and minimum with slippage
    console.log('=== Step 2: Calculate Expected Shares ===\n');

    const rate = await accountant.getRateInQuote(assetAddress);
    const ONE_SHARE = 10n ** BigInt(vaultDecimals);

    // Formula: shares = (assetAmount * ONE_SHARE) / rate
    const expectedShares = (depositAmount * ONE_SHARE) / rate;

    // Apply slippage protection
    const minimumShares = (expectedShares * (10000n - SLIPPAGE_BPS)) / 10000n;

    console.log(`Exchange rate: ${ethers.formatUnits(rate, assetDecimals)} ${ASSET_SYMBOL}/share`);
    console.log(`Expected shares: ${ethers.formatUnits(expectedShares, vaultDecimals)}`);
    console.log(`Minimum shares (${Number(SLIPPAGE_BPS) / 100}% slippage): ${ethers.formatUnits(minimumShares, vaultDecimals)}\n`);

    // Step 5: Check if teller is paused
    const isPaused = await teller.isPaused();
    if (isPaused) {
      console.error('❌ Teller is paused! Cannot deposit.');
      process.exit(1);
    }

    // Step 6: Execute deposit
    console.log('=== Step 3: Execute Deposit ===\n');

    const sharesBefore = await vault.balanceOf(signer.address);

    console.log(`Shares before: ${ethers.formatUnits(sharesBefore, vaultDecimals)}`);
    console.log(`Depositing ${DEPOSIT_AMOUNT} ${ASSET_SYMBOL}...`);

    const depositTx = await teller.deposit(
      assetAddress,
      depositAmount,
      minimumShares
    );

    console.log(`Transaction hash: ${depositTx.hash}`);
    const receipt = await depositTx.wait();
    console.log(`✅ Deposit confirmed in block ${receipt?.blockNumber}\n`);

    // Step 7: Verify result
    console.log('=== Step 4: Verify Result ===\n');

    const sharesAfter = await vault.balanceOf(signer.address);
    const sharesReceived = sharesAfter - sharesBefore;

    console.log(`Shares after: ${ethers.formatUnits(sharesAfter, vaultDecimals)}`);
    console.log(`Shares received: ${ethers.formatUnits(sharesReceived, vaultDecimals)}`);

    // Check share lock
    const shareUnlockTime = await teller.shareUnlockTime(signer.address);
    const unlockDate = new Date(Number(shareUnlockTime) * 1000);

    console.log(`\nShare unlock time: ${unlockDate.toISOString()}`);
    console.log(`⚠️  Your shares are LOCKED until the unlock time!`);
    console.log(`You cannot withdraw until shares are unlocked.\n`);

    console.log('=== Success! ===');
    console.log(`✅ Deposited ${DEPOSIT_AMOUNT} ${ASSET_SYMBOL}`);
    console.log(`✅ Received ${ethers.formatUnits(sharesReceived, vaultDecimals)} shares`);
    console.log('\nNext: Wait for share unlock, then try 05-withdrawal-workflow.ts');

  } catch (error: any) {
    console.error('\n❌ Deposit failed:');
    if (error.message) {
      console.error(error.message);
    }

    console.error('\nCommon issues:');
    console.error('1. Did you approve the VAULT (not Teller)?');
    console.error('2. Do you have enough tokens? Call asset.faucet()');
    console.error('3. Are asset deposits enabled? Run: npm run configure:assets');
    console.error('4. Is the exchange rate configured?');
    console.error('5. Check if Teller or Accountant is paused');
  }
}

void main().then(() => {
  process.exit(0);
});
