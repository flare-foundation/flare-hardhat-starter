/**
 * FirelightVault Deposit Script
 * 
 * This script deposits assets into the FirelightVault (ERC-4626).
 * It approves tokens and deposits the specified amount, receiving vault shares in return.
 * 
 * Usage:
 *   yarn hardhat run scripts/firelight/deposit.ts --network coston2
 */

import { ethers } from "hardhat";

export const FIRELIGHT_VAULT_ADDRESS = "0x91Bfe6A68aB035DFebb6A770FFfB748C03C0E40B";

export const IFirelightVault = artifacts.require("IFirelightVault");

const tokensToDeposit = 1; // Number of tokens to deposit

// @ts-expect-error - Type definitions issue, but works at runtime
const IERC20 = artifacts.require("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20");

async function getAccount() {
    const [signer] = await ethers.getSigners();
    return { signer, account: signer.address };
}

async function getVaultAndAsset() {
    const vault = await IFirelightVault.at(FIRELIGHT_VAULT_ADDRESS);
    const assetAddress = await vault.asset();
    const assetToken = await IERC20.at(assetAddress);
    return { vault, assetAddress, assetToken };
}

async function getAssetInfo(assetToken: any) {
    const symbol = await assetToken.symbol();
    const assetDecimals = await assetToken.decimals();
    return { symbol, assetDecimals };
}

function logDepositInfo(account: string, assetAddress: string, symbol: string, assetDecimals: any, amount: bigint) {
    console.log("=== Deposit (ERC-4626) ===");
    console.log("Sender:", account);
    console.log("Vault:", FIRELIGHT_VAULT_ADDRESS);
    console.log("Asset:", assetAddress, `(${symbol}, decimals=${assetDecimals})`);
    console.log("Deposit amount:", amount.toString(), `(= ${tokensToDeposit} ${symbol})`);
}

async function validateDeposit(vault: any, account: string, amount: bigint) {
    const maxDeposit = await vault.maxDeposit(account);
    console.log("Max deposit:", maxDeposit.toString());
    if (amount > BigInt(maxDeposit.toString())) {
        console.error(`Cannot deposit ${amount.toString()} assets. Max allowed: ${maxDeposit.toString()}`);
        process.exit(1);
    }
}

async function approveTokens(assetToken: any, vault: any, amount: bigint, account: string) {
    const approveTx = await assetToken.approve(vault.address, amount, { from: account });
    console.log("Approve tx:", approveTx.tx);
}

async function executeDeposit(vault: any, amount: bigint, account: string) {
    const depositTx = await vault.deposit(amount, account, { from: account });
    console.log("Deposit tx:", depositTx.tx);
}

async function main() {
    const { account } = await getAccount();
    const { vault, assetAddress, assetToken } = await getVaultAndAsset();
    const { symbol, assetDecimals } = await getAssetInfo(assetToken);
    
    const depositAmount = BigInt(tokensToDeposit * (10 ** Number(assetDecimals)));

    logDepositInfo(account, assetAddress, symbol, assetDecimals, depositAmount);

    await validateDeposit(vault, account, depositAmount);
    await approveTokens(assetToken, vault, depositAmount, account);
    await executeDeposit(vault, depositAmount, account);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

