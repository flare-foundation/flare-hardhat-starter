/**
 * Upshift Tokenized Vault Request Redeem Script
 *
 * This script requests a delayed redemption of LP shares from the Upshift Tokenized Vault.
 * After the lag duration passes, use the claim script to receive assets.
 *
 * Usage:
 *   yarn hardhat run scripts/upshift/requestRedeem.ts --network coston2
 */

import { web3 } from "hardhat";
import { parseUnits, formatUnits } from "ethers";

import { ITokenizedVaultInstance } from "../../typechain-types/contracts/upshift/ITokenizedVault";
import { IERC20Instance } from "../../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";

const VAULT_ADDRESS = "0x24c1a47cD5e8473b64EAB2a94515a196E10C7C81";
const SHARES_TO_REDEEM = "1";

const ITokenizedVault = artifacts.require("ITokenizedVault");
const IERC20 = artifacts.require("IERC20");
const IERC20Metadata = artifacts.require("IERC20Metadata");

async function main() {
    // 1. Initialize: Get user account from Hardhat network
    const accounts = await web3.eth.getAccounts();
    const userAddress = accounts[0];

    console.log("REQUEST REDEEM FROM VAULT\n");
    console.log("Vault Address:", VAULT_ADDRESS);
    console.log("User Address:", userAddress);

    // 2. Connect to the vault contract instance
    const vault: ITokenizedVaultInstance = await ITokenizedVault.at(VAULT_ADDRESS);

    // 3. Get reference asset (the token we'll receive after claim)
    const referenceAsset = await vault.asset();
    console.log("Reference Asset (asset receiving):", referenceAsset);

    // 4. Get token metadata (decimals and symbol) for formatting
    const refAsset = await IERC20Metadata.at(referenceAsset);
    const decimals = Number(await refAsset.decimals());
    const symbol = await refAsset.symbol();

    // 5. Get LP token and check user's LP balance
    const lpTokenAddress = await vault.lpTokenAddress();
    const lpToken: IERC20Instance = await IERC20.at(lpTokenAddress);

    console.log("\n1. Checking LP token balance...");
    const lpBalance = await lpToken.balanceOf(userAddress);
    console.log(`LP Balance: ${formatUnits(lpBalance.toString(), decimals)}`);

    // 6. Convert shares amount from human-readable to token units
    const sharesToRedeem = parseUnits(SHARES_TO_REDEEM, decimals);
    console.log(`Shares to Redeem: ${SHARES_TO_REDEEM} (${sharesToRedeem.toString()})`);

    // 7. Validate LP balance is sufficient for redemption
    if (BigInt(lpBalance.toString()) < sharesToRedeem) {
        console.log("Insufficient LP balance!");
        return;
    }

    // 8. Check and approve LP tokens for vault
    console.log("\n1b. Checking LP token allowance...");
    const lpAllowance = await lpToken.allowance(userAddress, VAULT_ADDRESS);
    console.log(`Current LP Allowance: ${formatUnits(lpAllowance.toString(), decimals)}`);

    if (BigInt(lpAllowance.toString()) < sharesToRedeem) {
        console.log(`Approving vault to spend ${SHARES_TO_REDEEM} LP tokens...`);
        const approveTx = await lpToken.approve(VAULT_ADDRESS, sharesToRedeem.toString());
        console.log("Approval Tx:", approveTx.tx);
    }

    // 9. Check vault configuration and restrictions
    console.log("\n2. Checking vault configuration...");
    const lagDuration = await vault.lagDuration();
    const withdrawalFee = await vault.withdrawalFee();
    const withdrawalsPaused = await vault.withdrawalsPaused();
    const maxWithdrawalAmount = await vault.maxWithdrawalAmount();

    console.log(`Lag Duration: ${lagDuration.toString()} seconds`);
    console.log(`Withdrawal Fee: ${formatUnits(withdrawalFee.toString(), 16)}%`);
    console.log(`Withdrawals Paused: ${withdrawalsPaused}`);
    console.log(`Max Withdrawal Amount: ${formatUnits(maxWithdrawalAmount.toString(), decimals)} ${symbol}`);

    if (withdrawalsPaused) {
        console.log("\nError: Withdrawals are currently paused!");
        return;
    }

    if (BigInt(maxWithdrawalAmount.toString()) > 0n && sharesToRedeem > BigInt(maxWithdrawalAmount.toString())) {
        console.log("\nError: Shares to redeem exceeds max withdrawal amount!");
        return;
    }

    // 10. Preview redemption to see expected assets (non-instant)
    const preview = await vault.previewRedemption(sharesToRedeem.toString(), false);
    const assetsAmount = preview[0];
    const assetsAfterFee = preview[1];
    console.log(`Expected Assets (before fee): ${formatUnits(assetsAmount.toString(), decimals)} ${symbol}`);
    console.log(`Expected Assets (after fee): ${formatUnits(assetsAfterFee.toString(), decimals)} ${symbol}`);

    // 11. Get current withdrawal epoch info
    console.log("\n3. Getting withdrawal epoch info...");
    const epochInfo = await vault.getWithdrawalEpoch();
    console.log(
        `Current Epoch - Year: ${epochInfo[0].toString()}, Month: ${epochInfo[1].toString()}, Day: ${epochInfo[2].toString()}`
    );
    console.log(`Claimable Epoch: ${epochInfo[3].toString()}`);

    // 12. Execute the redemption request
    console.log("\n4. Executing redemption request...");
    try {
        const requestTx = await vault.requestRedeem(sharesToRedeem.toString(), userAddress);
        console.log("Request Redeem: (tx:", requestTx.tx, ", block:", requestTx.receipt.blockNumber, ")");
    } catch (error: any) {
        console.error("\nError executing requestRedeem:");
        if (error.message.includes("WithdrawalsPaused")) {
            console.error("  - Withdrawals are paused");
        } else if (error.message.includes("InsufficientShares")) {
            console.error("  - Insufficient shares");
        } else if (error.message.includes("SenderNotWhitelisted")) {
            console.error("  - Your address is not whitelisted");
        } else if (error.message.includes("WithdrawalLimitReached")) {
            console.error("  - Withdrawal limit reached");
        } else if (error.message.includes("AmountTooLow")) {
            console.error("  - Amount too low");
        } else {
            console.error("  - Unknown error:", error.message);
        }
        throw error;
    }

    // 13. Parse the return values from the transaction logs
    // The function returns: (claimableEpoch, year, month, day)
    console.log("\n5. Redemption request details...");

    // Check LP balance after request
    const lpBalanceAfter = await lpToken.balanceOf(userAddress);
    const sharesLocked = BigInt(lpBalance.toString()) - BigInt(lpBalanceAfter.toString());
    console.log(`LP Balance After: ${formatUnits(lpBalanceAfter.toString(), decimals)}`);
    console.log(`Shares Locked: ${formatUnits(sharesLocked.toString(), decimals)}`);

    // Get updated epoch info
    const newEpochInfo = await vault.getWithdrawalEpoch();
    console.log(
        `\nClaim your assets after: ${newEpochInfo[0].toString()}/${newEpochInfo[1].toString()}/${newEpochInfo[2].toString()}`
    );
    console.log("Use the claim script with the date above to receive your assets.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
