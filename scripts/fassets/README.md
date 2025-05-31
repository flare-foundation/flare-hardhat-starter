# FAssets Scripts

This directory contains scripts for interacting with the FAssets system on the Flare network. 
These scripts handle various operations related to minting, redeeming, and managing FAssets.

Read more about FAssets https://dev.flare.network/fassets/overview

## Scripts Overview

### `executeMinting.ts`
Executes FAssets minting using FDC merkle proofs. Handles proof retrieval and contract interaction.

### `reserveCollateral.ts`
Manages collateral reservation by finding available agents and reserving collateral lots.

### `redeem.ts`
Handles FAssets redemption process and ticket creation.

### `mint.ts`
Orchestrates the complete minting workflow from collateral reservation to execution.

### `xrplPayment.ts`
Manages XRPL payment operations and reference data handling.
