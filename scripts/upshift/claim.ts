/**
 * Upshift Tokenized Vault Claim Script
 *
 * This script claims assets from a previously requested redemption.
 * Use requestRedeem.ts first to schedule a redemption.
 *
 * Usage:
 *   yarn hardhat run scripts/upshift/claim.ts --network coston2
 */

import { web3 } from "hardhat";
import { formatUnits } from "ethers";

import { ITokenizedVaultInstance } from "../../typechain-types/contracts/upshift/ITokenizedVault";
import { IERC20Instance } from "../../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";

const VAULT_ADDRESS = "0x24c1a47cD5e8473b64EAB2a94515a196E10C7C81";
const RECEIVER_ADDRESS = ""; // Leave empty to use sender's address

// Update these with the date from your requestRedeem call
const YEAR = 2026;
const MONTH = 1;
const DAY = 23;

const ITokenizedVault = artifacts.require("ITokenizedVault");
const IERC20 = artifacts.require("IERC20");
const IERC20Metadata = artifacts.require("IERC20Metadata");

async function main() {
    // 1. Initialize: Get user account from Hardhat network
    const accounts = await web3.eth.getAccounts();
    const userAddress = accounts[0];
    const receiverAddr = RECEIVER_ADDRESS || userAddress;

    console.log("CLAIM REDEMPTION\n");
    console.log("Vault Address:", VAULT_ADDRESS);
    console.log("User Address:", userAddress);
    console.log("Receiver Address:", receiverAddr);
    console.log(`Redemption Date: ${YEAR}-${String(MONTH).padStart(2, "0")}-${String(DAY).padStart(2, "0")}`);

    // 2. Connect to the vault contract instance
    const vault: ITokenizedVaultInstance = await ITokenizedVault.at(VAULT_ADDRESS);

    // 3. Check if there are shares to claim
    console.log("\n1. Checking pending redemption...");
    const shares = await vault.getBurnableAmountByReceiver(YEAR, MONTH, DAY, receiverAddr);

    if (BigInt(shares.toString()) === 0n) {
        console.log("No shares found for this date and receiver address");
        console.log("\nMake sure:");
        console.log("- The year, month, and day are correct");
        console.log("- The receiver address matches your requestRedeem call");
        return;
    }

    // 4. Get LP token info for formatting
    const lpTokenAddress = await vault.lpTokenAddress();
    const lpToken = await IERC20Metadata.at(lpTokenAddress);
    const lpDecimals = Number(await lpToken.decimals());
    const lpSymbol = await lpToken.symbol();

    console.log(`Shares to claim: ${formatUnits(shares.toString(), lpDecimals)} ${lpSymbol}`);

    // 5. Preview the redemption
    console.log("\n2. Previewing redemption...");
    const preview = await vault.previewRedemption(shares.toString(), false);
    const assetsAmount = preview[0];
    const assetsAfterFee = preview[1];

    const referenceAsset = await vault.asset();
    const refAsset = await IERC20Metadata.at(referenceAsset);
    const refDecimals = Number(await refAsset.decimals());
    const refSymbol = await refAsset.symbol();

    console.log(`Assets (before fee): ${formatUnits(assetsAmount.toString(), refDecimals)} ${refSymbol}`);
    console.log(`Assets (after fee): ${formatUnits(assetsAfterFee.toString(), refDecimals)} ${refSymbol}`);
    const fee = BigInt(assetsAmount.toString()) - BigInt(assetsAfterFee.toString());
    console.log(`Fee: ${formatUnits(fee.toString(), refDecimals)} ${refSymbol}`);

    // 6. Check if claimable
    console.log("\n3. Checking if claimable...");
    const block = await web3.eth.getBlock("latest");
    const blockTimestamp = BigInt(block.timestamp);
    const claimableDate = new Date(Date.UTC(YEAR, MONTH - 1, DAY, 0, 0, 0));
    const claimableEpoch = BigInt(Math.floor(claimableDate.getTime() / 1000));
    const TIMESTAMP_MANIPULATION_WINDOW = 300n; // 5 minutes

    console.log(`Current Timestamp: ${blockTimestamp.toString()}`);
    console.log(`Claimable Epoch: ${claimableEpoch.toString()}`);

    const canClaim = blockTimestamp + TIMESTAMP_MANIPULATION_WINDOW >= claimableEpoch;

    if (!canClaim) {
        const timeUntil = claimableEpoch - blockTimestamp - TIMESTAMP_MANIPULATION_WINDOW;
        const hoursUntil = Number(timeUntil) / 3600;
        console.log("Cannot claim yet!");
        console.log(`Wait approximately ${hoursUntil.toFixed(2)} more hours`);
        console.log(`Claimable after: ${new Date(Number(claimableEpoch) * 1000).toISOString()}`);
        return;
    }
    console.log("Ready to claim!");

    // 7. Check receiver balance before
    console.log("\n4. Checking receiver balance before...");
    const refToken: IERC20Instance = await IERC20.at(referenceAsset);
    const balanceBefore = await refToken.balanceOf(receiverAddr);
    console.log(`Balance: ${formatUnits(balanceBefore.toString(), refDecimals)} ${refSymbol}`);

    // 8. Execute claim
    console.log("\n5. Claiming...");
    const claimTx = await vault.claim(YEAR, MONTH, DAY, receiverAddr);
    console.log("Claim: (tx:", claimTx.tx, ", block:", claimTx.receipt.blockNumber, ")");

    // 9. Verify claim
    console.log("\n6. Verifying claim...");
    const balanceAfter = await refToken.balanceOf(receiverAddr);
    const received = BigInt(balanceAfter.toString()) - BigInt(balanceBefore.toString());
    console.log(`Balance After: ${formatUnits(balanceAfter.toString(), refDecimals)} ${refSymbol}`);
    console.log(`Received: ${formatUnits(received.toString(), refDecimals)} ${refSymbol}`);

    if (received === BigInt(assetsAfterFee.toString())) {
        console.log("Claim successful!");
    } else {
        console.log("Received amount differs from expected (may be due to rounding)");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
