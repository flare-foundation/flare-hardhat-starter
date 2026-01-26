/**
 * Upshift Tokenized Vault Instant Redeem Script
 *
 * This script performs an instant redemption of LP shares from the Upshift Tokenized Vault.
 *
 * Usage:
 *   yarn hardhat run scripts/upshift/instantRedeem.ts --network coston2
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

    console.log("INSTANT REDEEM FROM VAULT\n");
    console.log("Vault Address:", VAULT_ADDRESS);
    console.log("User Address:", userAddress);

    // 2. Connect to the vault contract instance
    const vault: ITokenizedVaultInstance = await ITokenizedVault.at(VAULT_ADDRESS);

    // 3. Get reference asset (the token we'll receive)
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

    // 8. Check instant redemption fee
    console.log("\n2. Checking redemption details...");
    const instantRedemptionFee = await vault.instantRedemptionFee();
    console.log(`Instant Redemption Fee: ${formatUnits(instantRedemptionFee.toString(), 16)}%`);

    // 9. Preview redemption to see expected assets
    const preview = await vault.previewRedemption(sharesToRedeem.toString(), true);
    const assetsAmount = preview[0];
    const assetsAfterFee = preview[1];
    console.log(`Expected Assets (before fee): ${formatUnits(assetsAmount.toString(), decimals)} ${symbol}`);
    console.log(`Expected Assets (after fee): ${formatUnits(assetsAfterFee.toString(), decimals)} ${symbol}`);

    // 10. Check reference asset balance before redemption
    const assetBalanceBefore = await refAsset.balanceOf(userAddress);
    console.log(`\n3. Asset Balance Before: ${formatUnits(assetBalanceBefore.toString(), decimals)} ${symbol}`);

    // 11. Execute the instant redemption
    const redeemTx = await vault.instantRedeem(sharesToRedeem.toString(), userAddress);
    console.log("\n4. Instant Redeem: (tx:", redeemTx.tx, ", block:", redeemTx.receipt.blockNumber, ")");

    // 12. Verify redemption by comparing balances
    console.log("\n5. Verifying redemption...");
    const lpBalanceAfter = await lpToken.balanceOf(userAddress);
    const assetBalanceAfter = await refAsset.balanceOf(userAddress);

    const sharesRedeemed = BigInt(lpBalance.toString()) - BigInt(lpBalanceAfter.toString());
    const assetsReceived = BigInt(assetBalanceAfter.toString()) - BigInt(assetBalanceBefore.toString());

    console.log(`LP Balance After: ${formatUnits(lpBalanceAfter.toString(), decimals)}`);
    console.log(`Shares Redeemed: ${formatUnits(sharesRedeemed.toString(), decimals)}`);
    console.log(`Assets Received: ${formatUnits(assetsReceived.toString(), decimals)} ${symbol}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
