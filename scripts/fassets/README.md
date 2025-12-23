# FAssets Example Scripts

This directory contains scripts for interacting with the FAssets system on the Flare network. 
These scripts handle various operations related to minting, redeeming, and managing FAssets.

Read more about FAssets https://dev.flare.network/fassets/overview

- Run `autoRedeemFromHyperEVM.ts` to execute auto-redeem of FXRP from HyperEVM to the underlying XRP Ledger address using LayerZero compose.
- Run `autoRedeemFromSepolia.ts` to execute auto-redeem of FXRP from Sepolia to the underlying XRP Ledger address using LayerZero compose.
- Run `bridgeToHyperEVM.ts` to bridge FXRP from Flare to HyperEVM to ensure there's enough fxrp for auto-redeem.
- Run `bridgeToSepolia.ts` to bridge FXRP from Flare to Sepolia to ensure there's enough fxrp for auto-redeem.
- Run `deployFassetRedeemComposer.ts` to deploy the FAssetRedeemComposer contract.
- Run `executeMinting.ts` to execute FAssets minting using FDC Merkle proofs. Handles proof retrieval and contract interaction. Run after the `reserveCollateral.ts` script.
- Run `getLotSize.ts` to get the FAssets system lot size.
- Run `getRedemptionQueue.ts` to get the FAssets system agent redemption queue.
- Run `redeem.ts` to execute FAssets redemption and create redemption tickets.  
- Run `reserveCollateral.ts` to reserve collateral by finding available agents and reserving collateral lots.
- Run `settings.ts` to get the FAssets system parameter values.
- Run `swapAndRedeem.ts` to swap wrapped native token and redeem using the FAssets system using Uniswap V2 router.
- Run `xrplPayment.ts` to manage XRPL payment operations and handle reference data.
