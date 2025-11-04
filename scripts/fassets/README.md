# FAssets Example Scripts

This directory contains scripts for interacting with the FAssets system on the Flare network. 
These scripts handle various operations related to minting, redeeming, and managing FAssets.

Read more about FAssets https://dev.flare.network/fassets/overview

- Run `autoRedeem.ts` to execute auto-redeem of fXRP from Sepolia to underlying XRP address using LayerZero compose. 
- Run `executeMinting.ts` to execute FAssets minting using FDC Merkle proofs. Handles proof retrieval and contract interaction. Run after the `reserveCollateral.ts` script.
- Run `getLotSize.ts` to get the FAssets system lot size.
- Run `getRedemptionQueue.ts` to get the FAssets system agent redemption queue.
- Run `redeem.ts` to execute FAssets redemption and create redemption tickets.  
- Run `reserveCollateral.ts` to reserve collateral by finding available agents and reserving collateral lots.
- Run `settings.ts` to get the FAssets system parameter values.
- Run `swapAndRedeem.ts` to swap wrapped native token and redeem using the FAssets system using Uniswap V2 router.
- Run `xrplPayment.ts` to manage XRPL payment operations and handle reference data.
