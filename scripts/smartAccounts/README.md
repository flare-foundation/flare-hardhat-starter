# Bridge via Smart Account

Bridge FXRP from XRPL to Sepolia via Flare Smart Accounts using the FAssets protocol.

## Usage

```bash
yarn hardhat run scripts/smartAccounts/bridgeViaSmartAccount.ts --network coston2
```

## Prerequisites

Add to your `.env` file:
```bash
PRIVATE_KEY=your_private_key_here
XRPL_SECRET=your_xrpl_secret_here
SEPOLIA_API_KEY=your_sepolia_api_key_here
```

Fund your XRPL testnet account: https://faucet.altnet.rippletest.net/

## Configuration

Edit the `CONFIG` object in the script:

- `BRIDGE_AMOUNT` - Amount of FXRP to bridge (default: "10")
- `AUTO_MINT_IF_NEEDED` - Automatically mint FXRP if balance insufficient (default: true)
- `MINT_LOTS` - Number of lots to mint if needed (1 lot = 10 FXRP, default: 1)

## What It Does

1. Checks your Smart Account FXRP balance
2. Automatically mints FXRP via FAssets if balance is insufficient
3. Registers a custom bridge instruction with MasterAccountController
4. Sends XRPL payment with encoded instruction
5. Retrieves FDC attestation proof
6. Executes the bridge to Sepolia via LayerZero

## XRP Requirements

- **If minting needed**: ~11 XRP (1 XRP trigger + 10 XRP collateral for 1 lot)
- **Bridge payment**: 1 XRP
- **Total**: ~12 XRP + fees
-
