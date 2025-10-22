/**
 * Example 06: Approval Management
 *
 * This example demonstrates token approval patterns and best practices for Boring Vault.
 *
 * You'll learn:
 * - Why you must approve the VAULT (not the Teller!)
 * - Checking current allowances
 * - Infinite vs exact approvals
 * - Revoking approvals
 * - Gas-efficient approval strategies
 *
 * Run: npx hardhat run examples/06-approval-management.ts --network coston2
 *
 * CRITICAL CONCEPT:
 * For deposits, approve the VAULT address, NOT the Teller!
 * The Teller calls vault.enter() → vault.enter() calls transferFrom(user, vault, amount)
 * The VAULT performs the actual token transfer, so it needs the approval!
 */

import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
    console.log("=== Boring Vault Approval Management ===\n");

    // Load deployment
    const addressesPath = "./deployment-addresses.json";
    if (!fs.existsSync(addressesPath)) {
        console.error("❌ deployment-addresses.json not found!");
        process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
    const [signer] = await ethers.getSigners();

    console.log(`User: ${signer.address}\n`);

    try {
        // Get contract addresses
        const vaultAddress = deployment.addresses.boringVault;
        const tellerAddress = deployment.addresses.teller;

        console.log(`Vault (approve THIS): ${vaultAddress}`);
        console.log(`Teller (NOT this!): ${tellerAddress}\n`);

        // Get test token (TUSD)
        const asset = await ethers.getContractAt("TestERC20", deployment.addresses.tusd);
        const symbol = await asset.symbol();
        const decimals = await asset.decimals();

        console.log(`Asset: ${symbol} (${deployment.addresses.tusd})\n`);

        // =========================================================================
        // Pattern 1: Check Current Allowances
        // =========================================================================
        console.log("=== Pattern 1: Check Current Allowances ===\n");

        const vaultAllowance = await asset.allowance(signer.address, vaultAddress);
        const tellerAllowance = await asset.allowance(signer.address, tellerAddress);

        console.log(`Allowance for VAULT: ${ethers.formatUnits(vaultAllowance, decimals)} ${symbol}`);
        console.log(`Allowance for TELLER: ${ethers.formatUnits(tellerAllowance, decimals)} ${symbol}`);

        if (tellerAllowance > 0n) {
            console.log(`\n⚠️  WARNING: You have an allowance set for the Teller!`);
            console.log(`This is unnecessary and won't work for deposits.`);
            console.log(`Deposits require approval for the VAULT address.\n`);
        }

        // =========================================================================
        // Pattern 2: Exact Approval (Gas Efficient for Single Use)
        // =========================================================================
        console.log("=== Pattern 2: Exact Approval ===\n");
        console.log("Use this when you know the exact amount you want to deposit.");
        console.log("More gas-efficient for one-time operations.\n");

        const depositAmount = ethers.parseUnits("100", decimals);
        console.log(`Approving exactly ${ethers.formatUnits(depositAmount, decimals)} ${symbol} for vault...`);

        const exactApproveTx = await asset.approve(vaultAddress, depositAmount);
        await exactApproveTx.wait();

        const newAllowance = await asset.allowance(signer.address, vaultAddress);
        console.log(`✅ Allowance set to: ${ethers.formatUnits(newAllowance, decimals)} ${symbol}\n`);

        // =========================================================================
        // Pattern 3: Infinite Approval (Convenient for Frequent Use)
        // =========================================================================
        console.log("=== Pattern 3: Infinite Approval ===\n");
        console.log("Use this if you plan to deposit multiple times.");
        console.log("Saves gas on future deposits, but requires more trust.\n");

        const MAX_UINT256 = ethers.MaxUint256;
        console.log(`Approving infinite ${symbol} for vault...`);
        console.log(`Amount: ${MAX_UINT256.toString()} (2^256 - 1)\n`);

        const infiniteApproveTx = await asset.approve(vaultAddress, MAX_UINT256);
        await infiniteApproveTx.wait();

        const infiniteAllowance = await asset.allowance(signer.address, vaultAddress);
        console.log(`✅ Allowance set to: ${infiniteAllowance.toString()}`);
        console.log(`This is effectively unlimited!\n`);

        // =========================================================================
        // Pattern 4: Revoke Approval (Security Best Practice)
        // =========================================================================
        console.log("=== Pattern 4: Revoke Approval ===\n");
        console.log("Use this to revoke access if you want to remove permissions.\n");

        console.log(`Revoking approval for vault...`);

        const revokeTx = await asset.approve(vaultAddress, 0n);
        await revokeTx.wait();

        const revokedAllowance = await asset.allowance(signer.address, vaultAddress);
        console.log(`✅ Allowance set to: ${ethers.formatUnits(revokedAllowance, decimals)} ${symbol}\n`);

        // =========================================================================
        // Pattern 5: Conditional Approval (Smart Check)
        // =========================================================================
        console.log("=== Pattern 5: Conditional Approval (Recommended) ===\n");
        console.log("Only approve if current allowance is insufficient.\n");

        async function ensureAllowance(token: any, owner: string, spender: string, amount: bigint, decimals: number) {
            const currentAllowance = await token.allowance(owner, spender);

            if (currentAllowance < amount) {
                console.log(`Current allowance: ${ethers.formatUnits(currentAllowance, decimals)}`);
                console.log(`Required: ${ethers.formatUnits(amount, decimals)}`);
                console.log(`Approving additional allowance...\n`);

                const approveTx = await token.approve(spender, amount);
                await approveTx.wait();

                console.log(`✅ Approval complete\n`);
                return true;
            } else {
                console.log(`✅ Sufficient allowance already exists\n`);
                return false;
            }
        }

        const requiredAmount = ethers.parseUnits("50", decimals);
        await ensureAllowance(asset, signer.address, vaultAddress, requiredAmount, decimals);

        // =========================================================================
        // Architecture Explanation
        // =========================================================================
        console.log("=== Why Approve the Vault? ===\n");

        console.log("Deposit Flow:");
        console.log("1. User calls: teller.deposit(asset, amount, minShares)");
        console.log("2. Teller calls: vault.enter(from=user, asset, amount, shares)");
        console.log("3. Vault calls: asset.transferFrom(user, vault, amount)");
        console.log("");
        console.log("The VAULT performs the transferFrom(), so it needs approval!");
        console.log("The Teller just orchestrates the flow using its AUTH role.\n");

        console.log("Withdrawal Flow:");
        console.log("1. User calls: teller.bulkWithdraw(asset, shares, minAssets, recipient)");
        console.log("2. Teller calls: vault.exit(to=recipient, asset, amount, shares)");
        console.log("3. Vault burns shares and transfers assets");
        console.log("");
        console.log("No approval needed! The vault burns your shares directly.\n");

        console.log("=== Best Practices ===\n");
        console.log("1. ✅ DO: Approve the VAULT for deposits");
        console.log("2. ❌ DON'T: Approve the TELLER (it won't work!)");
        console.log("3. 💡 TIP: Use conditional approval to save gas");
        console.log("4. 🔒 SECURITY: Revoke approvals when done if using infinite approval");
        console.log("5. 📊 MONITORING: Check allowances before transactions\n");

        console.log("=== Success! ===");
        console.log("You now understand approval management for Boring Vault!");
    } catch (error: any) {
        console.error("\n❌ Error:");
        if (error.message) {
            console.error(error.message);
        }
    }
}

void main().then(() => {
    process.exit(0);
});
