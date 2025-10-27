# Boring Vault Integration Examples

This directory contains standalone, runnable examples demonstrating how to interact with Boring Vault contracts. Each example focuses on a specific operation or concept.

## Prerequisites

```bash
npm install
```

Ensure you have:
- Contract addresses configured in `src/lib/config/contracts.ts`
- Access to Coston2 testnet RPC
- A wallet with test tokens (for write operations)

## Running Examples

Each example is a standalone TypeScript file that can be run with Hardhat:

```bash
npx hardhat run scripts/boringVault/readVaultInfo.ts --network coston2
```

## Example Overview

### Read Operations (No Wallet Required)

| Example | Description |
|---------|-------------|
| `readVaultInfo.ts` | Read vault metadata (name, symbol, decimals, supply) |
| `checkUserBalance.ts` | Query user's share balance and unlock status |
| `calculateExchangeRates.ts` | Fetch and use exchange rates for calculations |

### Write Operations (Wallet Required)

| Example | Description |
|---------|-------------|
| `depositWorkflow.ts` | Complete deposit flow with approval and slippage |
| `withdrawalWorkflow.ts` | Complete withdrawal flow with unlock checks |
| `approvalManagement.ts` | Token approval patterns and best practices |
| `ftsoOracleIntegration.ts` | FTSO oracle integration examples |

## Example Details

### readVaultInfo.ts
Learn the basics of reading from the BoringVault contract.
- Contract initialization with Hardhat/ethers
- Reading ERC20 metadata
- Fetching total supply
- Formatting output

**Key Concepts**: Contract reads, BigInt handling, formatting

### checkUserBalance.ts
Query user-specific data from Vault and Teller.
- Reading user's share balance
- Checking share unlock time
- Calculating ownership percentage
- Time-based logic

**Key Concepts**: User state, time handling, percentage calculations

### calculateExchangeRates.ts
Work with the Accountant contract to get exchange rates.
- Fetching rates for multiple assets
- Converting shares to assets
- Converting assets to shares
- Handling different decimals

**Key Concepts**: Rate math, decimal precision, multi-asset support

### depositWorkflow.ts
Complete implementation of a deposit transaction.
- Checking asset allowance
- Approving vault (not teller!)
- Calculating minimum shares with slippage
- Executing deposit
- Waiting for confirmation

**Key Concepts**: Token approvals, slippage protection, transaction flow

### withdrawalWorkflow.ts
Complete implementation of a withdrawal transaction.
- Verifying shares are unlocked
- Calculating expected assets
- Setting minimum asset amount
- Executing withdrawal
- Handling recipient addresses

**Key Concepts**: Share locks, slippage protection, safe withdrawals

### approvalManagement.ts
Advanced approval patterns and gas optimization.
- Checking current allowances
- Infinite vs. exact approvals
- Approval revocation
- Multi-asset approval strategies

**Key Concepts**: Gas optimization, security considerations, UX patterns

### ftsoOracleIntegration.ts
Working with Flare's FTSO oracles for price feeds.
- Fetching FTSO prices
- Integrating with rate providers
- Handling different oracle types
- Price feed validation

**Key Concepts**: Oracle integration, price feeds, rate providers

## Code Patterns Used

### Contract Setup
```typescript
import { ethers } from 'hardhat';

const vault = await ethers.getContractAt('BoringVault', vaultAddress);
```

### Reading Contract Data
```typescript
const totalSupply = await vault.totalSupply();
const decimals = await vault.decimals();
const formattedSupply = ethers.formatUnits(totalSupply, decimals);
```

### Writing Transactions (with Wallet)
```typescript
const [signer] = await ethers.getSigners();

const tx = await teller.deposit(
  depositAsset,
  depositAmount,
  minimumMint
);
await tx.wait();
```

### Error Handling
```typescript
try {
  const result = await vault.totalSupply();
  console.log('Success:', result);
} catch (error) {
  if (error instanceof Error) {
    console.error('Error:', error.message);
  }
}
```

## Configuration

### Environment Variables

Configure your Hardhat network settings in `hardhat.config.ts` for the Coston2 testnet.

### Contract Addresses

Examples use addresses from `deployment-addresses.json`. This file is generated after deploying the contracts.

## Common Issues

### "deployment-addresses.json not found"
- Deploy contracts first or ensure the file exists with valid addresses
- Ensure you're using Coston2 testnet

### "Insufficient funds"
- Get test tokens from Coston2 faucet or use the faucet() function on test tokens
- Check you have enough FLR for gas fees

### "Transfer from failed"
- Verify you're approving the **Vault**, not the Teller
- See `depositWorkflow.ts` for correct pattern

### "Shares are locked"
- Wait for share lock period to expire
- Check `shareLockPeriod` in Teller contract

## Next Steps

1. Deploy contracts or ensure `deployment-addresses.json` exists
2. Run read examples to understand contract structure
3. Study the calculation examples for math operations
4. Try write examples on testnet with small amounts
5. Read the source code - it's heavily commented!

## Additional Resources

- **Boring Vault Docs**: https://docs.veda.tech/integrations/boringvault-protocol-integration
- **Ethers.js Docs**: https://docs.ethers.org
- **Hardhat Docs**: https://hardhat.org/docs
- **Contract Source**: https://github.com/Se7en-Seas/boring-vault

## Contributing

Found an issue or want to add an example? Please open a PR!
