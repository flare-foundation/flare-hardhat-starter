/**
 * FirelightVault Redeem Script
 * 
 * This script creates a redemption request from the FirelightVault (ERC-4626).
 * Redeem burns shares to withdraw assets. Redemptions are delayed and must be claimed after the period ends.
 * 
 * Usage:
 *   yarn hardhat run scripts/firelight/redeem.ts --network coston2
 */

import { ethers } from "hardhat";

export const FIRELIGHT_VAULT_ADDRESS = "0x91Bfe6A68aB035DFebb6A770FFfB748C03C0E40B";

export const IFirelightVault = artifacts.require("IFirelightVault");

const sharesToRedeem = 1; // Number of shares to redeem

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

function logRedeemInfo(account: string, assetAddress: string, symbol: string, assetDecimals: any, sharesAmount: bigint) {
    console.log("=== Redeem (ERC-4626) ===");
    console.log("Sender:", account);
    console.log("Vault:", FIRELIGHT_VAULT_ADDRESS);
    console.log("Asset:", assetAddress, `(${symbol}, decimals=${assetDecimals})`);
    console.log("Shares to redeem:", sharesAmount.toString(), `(= ${sharesToRedeem} share${sharesToRedeem > 1 ? 's' : ''})`);
}

async function validateRedeem(vault: any, account: string, sharesAmount: bigint) {
    const maxRedeem = await vault.maxRedeem(account);
    console.log("Max redeem:", maxRedeem.toString());
    if (sharesAmount > BigInt(maxRedeem.toString())) {
        console.error(`Cannot redeem ${sharesAmount.toString()} shares. Max allowed: ${maxRedeem.toString()}`);
        process.exit(1);
    }
}

async function checkUserBalance(vault: any, account: string, sharesAmount: bigint, assetDecimals: bigint) {
    const userBalance = await vault.balanceOf(account);
    const formattedUserBalance = (Number(userBalance.toString()) / Math.pow(10, Number(assetDecimals))).toFixed(Number(assetDecimals));
    console.log("User balance (shares):", userBalance.toString(), `(= ${formattedUserBalance} shares)`);
    if (BigInt(userBalance.toString()) < sharesAmount) {
        console.error(`Insufficient balance. Need ${sharesAmount.toString()} shares, have ${userBalance.toString()}`);
        process.exit(1);
    }
}

async function executeRedeem(vault: any, sharesAmount: bigint, account: string) {
    const redeemTx = await vault.redeem(sharesAmount, account, account, { from: account });
    console.log("Redeem tx:", redeemTx.tx);
}

async function main() {
    const { account } = await getAccount();
    const { vault, assetAddress, assetToken } = await getVaultAndAsset();
    const { symbol, assetDecimals } = await getAssetInfo(assetToken);

    const sharesAmount = BigInt(sharesToRedeem * (10 ** Number(assetDecimals)));

    logRedeemInfo(account, assetAddress, symbol, assetDecimals, sharesAmount);
    
    await validateRedeem(vault, account, sharesAmount);
    await checkUserBalance(vault, account, sharesAmount, assetDecimals);
    await executeRedeem(vault, sharesAmount, account);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

