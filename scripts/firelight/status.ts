/**
 * FirelightVault Status Script
 * 
 * This script displays information about a FirelightVault contract.
 * It shows vault metrics, period configuration, user balances, and withdrawal information etc.
 * 
 * Usage:
 *   yarn hardhat run scripts/firelight/status.ts --network coston2
 */

import { ethers } from "hardhat";
import { formatTimestamp } from "../utils/core";

export const FIRELIGHT_VAULT_ADDRESS = "0x91Bfe6A68aB035DFebb6A770FFfB748C03C0E40B";

export const IFirelightVault = artifacts.require("IFirelightVault");

// @ts-expect-error - Type definitions issue, but works at runtime
const IERC20 = artifacts.require("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20");

async function getAccount() {
    const [signer] = await ethers.getSigners();
    return { signer, account: signer.address };
}

async function getVault() {
    return await IFirelightVault.at(FIRELIGHT_VAULT_ADDRESS);
}

async function getVaultInfo(vault: any) {
    const asset = await vault.asset();
    const totalAssets = await vault.totalAssets();
    const totalSupply = await vault.totalSupply();
    const currentPeriod = await vault.currentPeriod();
    const currentPeriodStart = await vault.currentPeriodStart();
    const currentPeriodEnd = await vault.currentPeriodEnd();
    const nextPeriodEnd = await vault.nextPeriodEnd();
    const pcLen = await vault.periodConfigurationsLength();
    const currentPeriodConfig = await vault.currentPeriodConfiguration();
    return {
        asset,
        totalAssets,
        totalSupply,
        currentPeriod,
        currentPeriodStart,
        currentPeriodEnd,
        nextPeriodEnd,
        pcLen,
        currentPeriodConfig,
    };
}

async function getAssetInfo(assetToken: any) {
    const symbol = await assetToken.symbol();
    const assetDecimals = await assetToken.decimals();
    return { symbol, assetDecimals };
}

function logAssetInfo(asset: string, assetSymbol: string, assetDecimals: any) {
    console.log("\n=== Asset ===");
    console.log("Asset address:", asset);
    console.log("Asset symbol:", assetSymbol);
    console.log("Asset decimals:", assetDecimals.toString());
}

function logVaultBalances(totalAssets: any, totalSupply: any, assetSymbol: string, assetDecimals: any) {
    console.log("\n=== Vault Balances ===");
    const assetDecimalsNum = Number(assetDecimals);
    const formattedTotalAssets = (Number(totalAssets.toString()) / Math.pow(10, assetDecimalsNum)).toFixed(assetDecimalsNum);
    const formattedTotalSupply = (Number(totalSupply.toString()) / Math.pow(10, assetDecimalsNum)).toFixed(assetDecimalsNum);
    console.log("Total assets (excl. pending withdrawals):", totalAssets.toString(), `(${formattedTotalAssets} ${assetSymbol})`);
    console.log("Total supply (shares):", totalSupply.toString(), `(${formattedTotalSupply} shares)`);
    
    // Calculate exchange rate (assets per share)
    const totalAssetsBN = BigInt(totalAssets.toString());
    const totalSupplyBN = BigInt(totalSupply.toString());
    if (totalSupplyBN !== 0n) {
        // Calculate: (totalAssets * 10^assetDecimals) / totalSupply for precision
        const precision = BigInt(10) ** BigInt(assetDecimalsNum);
        const rateBN = (totalAssetsBN * precision) / totalSupplyBN;
        const formattedRate = (Number(rateBN.toString()) / Math.pow(10, assetDecimalsNum)).toFixed(assetDecimalsNum);
        console.log("Exchange rate:", formattedRate, `${assetSymbol}/share`);
    } else {
        console.log("Exchange rate: N/A (no shares minted)");
    }
}

function logPeriodConfiguration(
    pcLen: any,
    currentPeriod: any,
    currentPeriodStart: any,
    currentPeriodEnd: any,
    nextPeriodEnd: any,
    currentPeriodConfig: any
) {
    console.log("\n=== Period Configuration ===");
    console.log("Period configurations count:", pcLen.toString());
    console.log("Current period:", currentPeriod.toString());
    console.log("Current period start:", formatTimestamp(currentPeriodStart));
    console.log("Current period end:", formatTimestamp(currentPeriodEnd));
    console.log("Next period end:", formatTimestamp(nextPeriodEnd));
    console.log("Current period config:", {
        epoch: currentPeriodConfig.epoch.toString(),
        duration: currentPeriodConfig.duration.toString(),
        startingPeriod: currentPeriodConfig.startingPeriod.toString(),
    });
}

async function getUserInfo(vault: any, account: string) {
    const userBalance = await vault.balanceOf(account);
    const userMaxDeposit = await vault.maxDeposit(account);
    const userMaxMint = await vault.maxMint(account);
    const userMaxWithdraw = await vault.maxWithdraw(account);
    const userMaxRedeem = await vault.maxRedeem(account);
    const userBalanceAssets = await vault.convertToAssets(userBalance);
    return {
        userBalance,
        userMaxDeposit,
        userMaxMint,
        userMaxWithdraw,
        userMaxRedeem,
        userBalanceAssets,
    };
}

function logUserInfo(account: string, userInfo: any, assetSymbol: string, assetDecimals: any) {
    console.log("\n=== User Info ===");
    console.log("Account:", account);
    
    const assetDecimalsNum = Number(assetDecimals);
    const formattedUserBalance = (Number(userInfo.userBalance.toString()) / Math.pow(10, assetDecimalsNum)).toFixed(assetDecimalsNum);
    const formattedUserBalanceAssets = (Number(userInfo.userBalanceAssets.toString()) / Math.pow(10, assetDecimalsNum)).toFixed(assetDecimalsNum);
    
    console.log("User balance (shares):", userInfo.userBalance.toString(), `(${formattedUserBalance} shares)`);
    console.log("User balance (assets):", userInfo.userBalanceAssets.toString(), `(${formattedUserBalanceAssets} ${assetSymbol})`);
    console.log("Max deposit:", userInfo.userMaxDeposit.toString());
    console.log("Max mint:", userInfo.userMaxMint.toString());
    console.log("Max withdraw:", userInfo.userMaxWithdraw.toString());
    console.log("Max redeem:", userInfo.userMaxRedeem.toString());
}

async function logUserWithdrawals(vault: any, account: string, currentPeriod: any, assetSymbol: string, assetDecimals: any) {
    console.log("\n=== User Withdrawals ===");
    const currentPeriodBN = BigInt(currentPeriod.toString());
    const periodsToCheck = [currentPeriodBN];
    
    if (currentPeriodBN !== 0n) {
        periodsToCheck.push(currentPeriodBN - 1n);
    }

    const assetDecimalsNum = Number(assetDecimals);
    for (const period of periodsToCheck) {
        try {
            const withdrawals = await vault.withdrawalsOf(period, account, { from: account });
            if (!withdrawals.isZero()) {
                const formattedWithdrawals = (Number(withdrawals.toString()) / Math.pow(10, assetDecimalsNum)).toFixed(assetDecimalsNum);
                console.log(`Period ${period.toString()}: ${withdrawals.toString()} (${formattedWithdrawals} ${assetSymbol})`);
            }
        } catch {
            // Silently skip if period doesn't exist or other error
        }
    }
}

async function main() {
    const { account } = await getAccount();
    const vault = await getVault();
    const vaultInfo = await getVaultInfo(vault);
    
    const assetToken = await IERC20.at(vaultInfo.asset);
    const { symbol: assetSymbol, assetDecimals } = await getAssetInfo(assetToken);

    logAssetInfo(vaultInfo.asset, assetSymbol, assetDecimals);
    logVaultBalances(vaultInfo.totalAssets, vaultInfo.totalSupply, assetSymbol, assetDecimals);
    logPeriodConfiguration(
        vaultInfo.pcLen,
        vaultInfo.currentPeriod,
        vaultInfo.currentPeriodStart,
        vaultInfo.currentPeriodEnd,
        vaultInfo.nextPeriodEnd,
        vaultInfo.currentPeriodConfig
    );
    
    const userInfo = await getUserInfo(vault, account);
    logUserInfo(account, userInfo, assetSymbol, assetDecimals);
    await logUserWithdrawals(vault, account, vaultInfo.currentPeriod, assetSymbol, assetDecimals);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
