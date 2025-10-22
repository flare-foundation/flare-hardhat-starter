/**
 * Example 01: Read Vault Information
 *
 * This example demonstrates how to read basic information from the BoringVault contract.
 * No wallet required - these are read-only operations.
 *
 * You'll learn:
 * - How to connect to a deployed vault contract
 * - Reading ERC20 metadata (name, symbol, decimals)
 * - Fetching total supply
 * - Formatting BigInt values for display
 *
 * Run: npx hardhat run scripts/boringVault/readVaultInfo.ts --network coston2
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';

async function main() {
  console.log('=== Reading Boring Vault Information ===\n');

  // Step 1: Load deployed contract addresses
  const addressesPath = './deployment-addresses.json';
  if (!fs.existsSync(addressesPath)) {
    console.error('❌ deployment-addresses.json not found!');
    console.error('Please run: npm run deploy:full');
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  const vaultAddress = deployment.addresses.boringVault;

  console.log(`Vault Address: ${vaultAddress}\n`);

  try {
    // Step 2: Get the contract instance
    // We can use the built-in ERC20 interface from ethers
    const vault = await ethers.getContractAt('BoringVault', vaultAddress);

    // Step 3: Read the vault name
    const name = await vault.name();
    console.log(`Name: ${name}`);

    // Step 4: Read the vault symbol
    const symbol = await vault.symbol();
    console.log(`Symbol: ${symbol}`);

    // Step 5: Read the decimals (important for all calculations!)
    const decimals = await vault.decimals();
    console.log(`Decimals: ${decimals}`);

    // Step 6: Read the total supply (returns BigInt)
    const totalSupply = await vault.totalSupply();

    // Step 7: Format the BigInt for human-readable display
    const formattedSupply = ethers.formatUnits(totalSupply, decimals);
    console.log(`\nTotal Supply: ${formattedSupply} ${symbol}`);
    console.log(`Total Supply (raw): ${totalSupply.toString()}`);

    // Step 8: Read the owner of the vault
    const owner = await vault.owner();
    console.log(`\nOwner: ${owner}`);

    // Step 9: Read the authority (BoringVault uses Solady's Ownable)
    const authority = await vault.authority();
    console.log(`Authority: ${authority}`);

    // Step 10: Check if the vault is in share-based accounting mode
    // BoringVault can track share holdings differently
    console.log('\n=== Additional Vault Details ===');

    // Get the current network
    const network = await ethers.provider.getNetwork();
    console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);

    // Get vault contract code size (sanity check)
    const code = await ethers.provider.getCode(vaultAddress);
    console.log(`Contract Code Size: ${(code.length - 2) / 2} bytes`);

    console.log('\n=== Success! ===');
    console.log('You now know how to read basic vault information.');
    console.log('Next: Try checkUserBalance.ts to query user-specific data.');

  } catch (error) {
    console.error('\n❌ Error reading vault info:');
    if (error instanceof Error) {
      console.error(error.message);
    }
    console.error('\nTroubleshooting:');
    console.error('1. Check that deployment-addresses.json exists and has valid addresses');
    console.error('2. Verify the Coston2 RPC endpoint is accessible');
    console.error('3. Ensure the vault contract is deployed at the configured address');
    console.error('4. Run with: npx hardhat run examples/01-read-vault-info.ts --network coston2');
  }
}

void main().then(() => {
  process.exit(0);
});
