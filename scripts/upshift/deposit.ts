/**
 * Upshift Tokenized Vault Deposit Script
 *
 * This script deposits assets into the Upshift Tokenized Vault.
 *
 * Usage:
 *   yarn hardhat run scripts/upshift/deposit.ts --network coston2
 */

import { web3 } from "hardhat";
import { parseUnits, formatUnits } from "ethers";

import { ITokenizedVaultInstance } from "../../typechain-types/contracts/upshift/ITokenizedVault";
import { IERC20Instance } from "../../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";

const VAULT_ADDRESS = "0x24c1a47cD5e8473b64EAB2a94515a196E10C7C81";
const DEPOSIT_AMOUNT = "1";

const ITokenizedVault = artifacts.require("ITokenizedVault");
const IERC20 = artifacts.require("IERC20");
const IFAsset = artifacts.require("IFAsset");

async function main() {
    // 1. Initialize: Get user account from Hardhat network
    const accounts = await web3.eth.getAccounts();
    const userAddress = accounts[0];

    console.log("DEPOSIT TO VAULT\n");
    console.log("Vault Address:", VAULT_ADDRESS);
    console.log("User Address:", userAddress);

    // 2. Connect to the vault contract instance
    const vault: ITokenizedVaultInstance = await ITokenizedVault.at(VAULT_ADDRESS);

    // 3. Get reference asset (the token we're depositing)
    const referenceAsset = await vault.asset();
    console.log("\nReference Asset (asset depositing):", referenceAsset);

    // 4. Get token metadata (decimals and symbol) for formatting
    const refAsset = await IFAsset.at(referenceAsset);
    const decimals = Number(await refAsset.decimals());
    const symbol = await refAsset.symbol();

    // 5. Convert deposit amount from human-readable to token units
    const depositAmount = parseUnits(DEPOSIT_AMOUNT, decimals);
    console.log(`\nDeposit Amount: ${DEPOSIT_AMOUNT} ${symbol} (${depositAmount.toString()})`);

    // 6. Check user balance to ensure sufficient funds
    const balance = await refAsset.balanceOf(userAddress);
    console.log(`Balance: ${formatUnits(balance.toString(), decimals)} ${symbol}`);

    // 7. Validate balance is sufficient for deposit
    if (BigInt(balance.toString()) < depositAmount) {
        console.log("Insufficient balance!");
        return;
    }

    // 8. Check current allowance (how much vault can spend on user's behalf)
    const allowance = await refAsset.allowance(userAddress, VAULT_ADDRESS);
    console.log(`Current Allowance: ${formatUnits(allowance.toString(), decimals)} ${symbol}`);

    // 9. Approve vault to spend tokens if current allowance is insufficient
    if (BigInt(allowance.toString()) < depositAmount) {
        console.log(`\nApproving vault to spend ${DEPOSIT_AMOUNT} ${symbol} tokens`);
        const approveTx = await refAsset.approve(VAULT_ADDRESS, depositAmount.toString());
        console.log("Approval Tx:", approveTx.tx);
    }

    // 10. Preview deposit to see expected shares and amount in reference tokens
    const preview = await vault.previewDeposit(referenceAsset, depositAmount.toString());
    const expectedShares = preview[0];
    const amountInRefTokens = preview[1];
    console.log(`\nExpected Shares: ${formatUnits(expectedShares.toString(), decimals)}`);
    console.log(`Amount in Reference Tokens: ${formatUnits(amountInRefTokens.toString(), decimals)}`);

    // 11. Get LP token address and check balance before deposit
    const lpTokenAddress = await vault.lpTokenAddress();
    const lpToken: IERC20Instance = await IERC20.at(lpTokenAddress);
    const lpBalanceBefore = await lpToken.balanceOf(userAddress);
    console.log(`LP Balance Before: ${formatUnits(lpBalanceBefore.toString(), decimals)}`);

    // 12. Execute the deposit transaction
    const depositTx = await vault.deposit(referenceAsset, depositAmount.toString(), userAddress);
    console.log("\nDeposit: (tx: ", depositTx.tx, ", block: ", depositTx.receipt.blockNumber, ")");

    // 13. Verify deposit by comparing LP token balance before and after
    console.log("\nVerifying deposit...");
    const lpBalanceAfter = await lpToken.balanceOf(userAddress);
    const sharesReceived = BigInt(lpBalanceAfter.toString()) - BigInt(lpBalanceBefore.toString());
    console.log(`LP Balance After: ${formatUnits(lpBalanceAfter.toString(), decimals)}`);
    console.log(`Shares Received: ${formatUnits(sharesReceived.toString(), decimals)}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
