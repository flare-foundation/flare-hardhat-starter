/**
 * FirelightVault Mint Script
 * 
 * This script mints vault shares (ERC-4626) by depositing assets into the FirelightVault.
 * It checks max mint capacity, calculates required assets, approves tokens, and mints shares.
 * 
 * Usage:
 *   yarn hardhat run scripts/firelight/mint.ts --network coston2
 */

import { ethers } from "hardhat";
import { IFirelightVaultInstance } from "../../typechain-types/contracts/firelight/IFirelightVault";

export const FIRELIGHT_VAULT_ADDRESS = "0x91Bfe6A68aB035DFebb6A770FFfB748C03C0E40B";

const sharesToMint = 1; // Number of shares to mint

// @ts-expect-error - Type definitions issue, but works at runtime
const IERC20 = artifacts.require("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20");

const FirelightVault = artifacts.require("IFirelightVault");

async function getAccount() {
    const [signer] = await ethers.getSigners();
    return { signer, account: signer.address };
}

async function getVaultAndAsset() {
    const vault = await FirelightVault.at(FIRELIGHT_VAULT_ADDRESS) as IFirelightVaultInstance;
    const assetAddress = await vault.asset();
    const assetToken = await IERC20.at(assetAddress);
    return { vault, assetAddress, assetToken };
}

async function getAssetInfo(assetToken: any) {
    const symbol = await assetToken.symbol();
    const assetDecimals = await assetToken.decimals();
    return { symbol, assetDecimals };
}

function logMintInfo(account: string, assetAddress: string, symbol: string, assetDecimals: any, sharesAmount: bigint) {
    console.log("=== Mint vault shares (ERC-4626) ===");
    console.log("Sender:", account);
    console.log("Vault:", FIRELIGHT_VAULT_ADDRESS);
    console.log("Asset:", assetAddress, `(${symbol}, decimals=${assetDecimals})`);
    console.log("Shares to mint:", sharesAmount.toString(), `(= ${sharesToMint} share${sharesToMint > 1 ? 's' : ''})`);
}

async function validateMint(vault: IFirelightVaultInstance, account: string, sharesAmount: bigint) {
    const maxMint = await vault.maxMint(account);
    console.log("Max mint:", maxMint.toString());
    if (sharesAmount > BigInt(maxMint.toString())) {
        console.error(`Cannot mint ${sharesAmount.toString()} shares. Max allowed: ${maxMint.toString()}`);
        process.exit(1);
    }
}

async function calculateAssetsNeeded(vault: IFirelightVaultInstance, sharesAmount: bigint) {
    const assetsNeeded = await vault.previewMint(sharesAmount.toString());
    console.log("Assets needed (from previewMint):", assetsNeeded.toString());
    return assetsNeeded;
}

async function approveTokens(assetToken: any, vault: any, amount: bigint, account: string) {
    const approveTx = await assetToken.approve(vault.address, amount, { from: account });
    console.log("Approve tx:", approveTx.tx);
}

async function executeMint(vault: IFirelightVaultInstance, sharesAmount: bigint, account: string) {
    const mintTx = await vault.mint(sharesAmount.toString(), account, { from: account });
    console.log("Mint tx:", mintTx.tx);
}

async function main() {
    const { account } = await getAccount();
    const { vault, assetAddress, assetToken } = await getVaultAndAsset();
    const { symbol, assetDecimals } = await getAssetInfo(assetToken);

    const sharesAmount = BigInt(sharesToMint * (10 ** Number(assetDecimals)));

    logMintInfo(account, assetAddress, symbol, assetDecimals, sharesAmount);
    
    await validateMint(vault, account, sharesAmount);
    const assetsNeeded = await calculateAssetsNeeded(vault, sharesAmount);
    await approveTokens(assetToken, vault, BigInt(assetsNeeded.toString()), account);
    await executeMint(vault, sharesAmount, account);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

