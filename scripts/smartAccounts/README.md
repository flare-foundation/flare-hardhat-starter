Here is a simple, clean `README.md` for your script.

***

# Flare Smart Account Bridge Script

This script automates the process of bridging **FXRP** from the Flare Testnet (Coston2) to Sepolia via **LayerZero**, triggered entirely by an **XRPL** payment.

It handles the entire lifecycle:
1.  **Account Discovery:** Finds or creates your Flare Personal Account derived from your XRPL address.
2.  **Auto-Minting:** If you lack FXRP, it automates the reservation and collateral transfer on XRPL to mint FTestXRP.
3.  **Gas Funding:** Automatically tops up your Smart Account with C2FLR (Gas) if needed.
4.  **Bridging:** Registers an atomic "Approve + Send" instruction and triggers it via an XRPL Memo payment.

## Prerequisites

1.  **XRPL Testnet Wallet:** Funded with testnet XRP (get it from the [XRPL Faucet](https://xrpl.org/xrp-testnet-faucet.html)).
2.  **Flare Coston2 Wallet:** Funded with C2FLR for gas (get it from the [Coston2 Faucet](https://faucet.flare.network/coston2)).

## Setup

1.  **Install Dependencies:**
    ```bash
    yarn install
    ```

2.  **Configure Environment:**
    Create a `.env` file in the root directory and add the following:
    ```env
    # Your EVM/Flare Private Key (Must hold C2FLR to pay for registration/gas)
    PRIVATE_KEY=0x...

    # Your XRPL Wallet Secret (e.g., sEd...)
    XRPL_SECRET=sEd...
    ```

## Usage

Run the script targeting the Coston2 network:

```bash
yarn hardhat run scripts/smartAccounts/bridgeViaSmartAccount.ts --network coston2
```

## What to Expect

The script will run through the following stages. **Do not close the terminal**, as it waits for Flare Data Connector (FDC) attestations which can take 3–5 minutes.

1.  **Registering Instruction:** You will see a transaction on Flare registering the LayerZero bridge capability.
2.  **Status Check:** It checks if you have a Personal Account, FXRP balance, and Gas.
3.  **Minting (Optional):** If you have 0 FXRP, it will send XRP payments to an Agent to mint new tokens.
4.  **Bridging:** It sends a ~0.1 XRP payment with a specific **Memo** to the Flare Operator.
5.  **Tracking:** Finally, it outputs a **LayerZero Scan link** where you can track your tokens moving to Sepolia.