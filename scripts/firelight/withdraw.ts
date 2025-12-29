/**
 * FirelightVault Withdraw Script
 * 
 * This script creates a withdrawal request from the FirelightVault (ERC-4626).
 * Withdrawals are delayed and must be claimed after the period ends.
 * 
 * Usage:
 *   yarn hardhat run scripts/firelight/withdraw.ts --network coston2
 */

export const FIRELIGHT_VAULT_ADDRESS = "0x91Bfe6A68aB035DFebb6A770FFfB748C03C0E40B";

export const IFirelightVault = artifacts.require("IFirelightVault");

const WITHDRAW_AMOUNT = 1; // Number of tokens to withdraw

async function main() {
    // Get the first account
    const accounts = await web3.eth.getAccounts();
    const account = accounts[0];
    
    const vault = await IFirelightVault.at(FIRELIGHT_VAULT_ADDRESS);
    
    // Get asset address from vault
    const assetAddress = await vault.asset();
    
    // @ts-expect-error - Type definitions issue, but works at runtime
    const IERC20 = artifacts.require("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20");
    const assetToken = await IERC20.at(assetAddress);

    const symbol = await assetToken.symbol();
    const assetDecimals = await assetToken.decimals();
    const assetDecimalsNum = Number(assetDecimals);
    const amount = WITHDRAW_AMOUNT * (10 ** assetDecimalsNum);

    console.log("=== Withdraw (ERC-4626) ===");
    console.log("Sender:", account);
    console.log("Vault:", FIRELIGHT_VAULT_ADDRESS);
    console.log("Asset:", assetAddress, `(${symbol}, decimals=${assetDecimals})`);
    console.log("Withdraw amount:", amount.toString(), `(= ${WITHDRAW_AMOUNT} ${symbol})`);

    // Check max withdraw capacity
    const maxWithdraw = await vault.maxWithdraw(account);
    console.log("Max withdraw:", maxWithdraw.toString());
    if (web3.utils.toBN(amount.toString()).gt(web3.utils.toBN(maxWithdraw.toString()))) {
        console.error(`Cannot withdraw ${amount.toString()} assets. Max allowed: ${maxWithdraw.toString()}`);
        process.exit(1);
    }

    // Check user balance
    const userBalance = await vault.balanceOf(account);
    const formattedUserBalance = (Number(userBalance.toString()) / Math.pow(10, assetDecimalsNum)).toFixed(assetDecimalsNum);
    console.log("User balance (shares):", userBalance.toString(), `(= ${formattedUserBalance} shares)`);

    // Withdraw creates a withdrawal request (no immediate asset transfer)
    const withdrawTx = await vault.withdraw(amount, account, account, { from: account });
    console.log("Withdraw tx:", withdrawTx.tx);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

