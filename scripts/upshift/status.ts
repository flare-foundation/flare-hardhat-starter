/**
 * Upshift Tokenized Vault Status Script
 *
 * This script displays the current status of the vault and user balances.
 *
 * Usage:
 *   yarn hardhat run scripts/upshift/status.ts --network coston2
 */

import { web3 } from "hardhat";
import { formatUnits } from "ethers";

import { ITokenizedVaultInstance } from "../../typechain-types/contracts/upshift/ITokenizedVault";
import { IERC20Instance } from "../../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";

const VAULT_ADDRESS = "0x24c1a47cD5e8473b64EAB2a94515a196E10C7C81";

const ITokenizedVault = artifacts.require("ITokenizedVault");
const IERC20 = artifacts.require("IERC20");
const IFAsset = artifacts.require("IFAsset");

async function main() {
    // 1. Initialize: Get user account from Hardhat network
    const accounts = await web3.eth.getAccounts();
    const userAddress = accounts[0];

    console.log("VAULT STATUS\n");
    console.log("Vault Address:", VAULT_ADDRESS);
    console.log("User Address:", userAddress);

    // 2. Connect to the vault contract instance
    const vault: ITokenizedVaultInstance = await ITokenizedVault.at(VAULT_ADDRESS);

    // 3. Get reference asset info
    const referenceAsset = await vault.asset();
    const refAsset = await IFAsset.at(referenceAsset);
    const decimals = Number(await refAsset.decimals());
    const symbol = await refAsset.symbol();

    console.log("\nReference Asset");
    console.log(`Address: ${referenceAsset}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);

    // 4. Get LP token info
    const lpTokenAddress = await vault.lpTokenAddress();
    const lpToken: IERC20Instance = await IERC20.at(lpTokenAddress);

    console.log("\nLP Token");
    console.log(`Address: ${lpTokenAddress}`);

    // 5. Get vault configuration
    console.log("\nVault Configuration");
    const withdrawalsPaused = await vault.withdrawalsPaused();
    const lagDuration = await vault.lagDuration();
    const withdrawalFee = await vault.withdrawalFee();
    const instantRedemptionFee = await vault.instantRedemptionFee();
    const maxWithdrawalAmount = await vault.maxWithdrawalAmount();

    console.log(`Withdrawals Paused: ${withdrawalsPaused}`);
    console.log(`Lag Duration: ${lagDuration.toString()} seconds`);
    console.log(`Withdrawal Fee: ${formatUnits(withdrawalFee.toString(), 16)}%`);
    console.log(`Instant Redemption Fee: ${formatUnits(instantRedemptionFee.toString(), 16)}%`);
    console.log(`Max Withdrawal Amount: ${formatUnits(maxWithdrawalAmount.toString(), decimals)} ${symbol}`);

    // 6. Get withdrawal epoch info
    console.log("\nWithdrawal Epoch");
    const epochInfo = await vault.getWithdrawalEpoch();
    console.log(`Year: ${epochInfo[0].toString()}, Month: ${epochInfo[1].toString()}, Day: ${epochInfo[2].toString()}`);
    console.log(`Claimable Epoch: ${epochInfo[3].toString()}`);

    // 7. Get user balances
    console.log("\nUser Balances");
    const refBalance = await refAsset.balanceOf(userAddress);
    const lpBalance = await lpToken.balanceOf(userAddress);

    console.log(`${symbol} Balance: ${formatUnits(refBalance.toString(), decimals)}`);
    console.log(`LP Token Balance: ${formatUnits(lpBalance.toString(), decimals)}`);

    // 8. Check allowances
    console.log("\nAllowances");
    const refAllowance = await refAsset.allowance(userAddress, VAULT_ADDRESS);
    const lpAllowance = await lpToken.allowance(userAddress, VAULT_ADDRESS);

    console.log(`${symbol} Allowance to Vault: ${formatUnits(refAllowance.toString(), decimals)}`);
    console.log(`LP Token Allowance to Vault: ${formatUnits(lpAllowance.toString(), decimals)}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
