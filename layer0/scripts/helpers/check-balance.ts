/**
 * Check FXRP balance on any network
 *
 * Usage:
 * npx hardhat run src/scripts/check-balance.ts --network sepolia
 * npx hardhat run src/scripts/check-balance.ts --network coston2
 */

import { ethers } from "hardhat";
import hre from "hardhat";

const CONTRACTS = {
    sepolia: {
        fxrp: ["0x81672c5d42F3573aD95A0bdfBE824FaaC547d4E6"],
        names: ["FXRP OFT"],
    },
    coston2: {
        fxrp: [
            "0x0b6A3645c240605887a5532109323A3E12273dc7", // FTestXRP from docs
            "0x8b4abA9C4BD7DD961659b02129beE20c6286e17F", // FTestXRP original
        ],
        names: ["FTestXRP (New)", "FTestXRP (Legacy)"],
    },
};

async function main() {
    const [signer] = await ethers.getSigners();
    const network = hre.network.name;

    console.log("═══════════════════════════════════════════════");
    console.log(`Network: ${network}`);
    console.log(`Address: ${signer.address}`);
    console.log("═══════════════════════════════════════════════\n");

    // Get native balance
    const nativeBalance = await signer.getBalance();
    const nativeSymbol = network === "coston2" ? "C2FLR" : network === "sepolia" ? "ETH" : "ETH";
    console.log(`💰 ${nativeSymbol} Balance: ${ethers.utils.formatEther(nativeBalance)}`);

    // Get FXRP balance if available
    if (CONTRACTS[network as keyof typeof CONTRACTS]) {
        const config = CONTRACTS[network as keyof typeof CONTRACTS];
        let totalBalance = ethers.BigNumber.from(0);
        let foundTokenAddress = "";

        for (let i = 0; i < config.fxrp.length; i++) {
            const tokenAddress = config.fxrp[i];
            const tokenName = config.names[i];

            try {
                // Try to use the OFT contract interface
                const fxrp = await ethers.getContractAt("FAssetOFT", tokenAddress);
                const balance = await fxrp.balanceOf(signer.address);

                // FXRP uses 6 decimals
                const decimals = 6;

                if (balance.gt(0)) {
                    console.log(`🪙  ${tokenName}: ${ethers.utils.formatUnits(balance, decimals)}`);
                    console.log(`    Contract: ${tokenAddress}`);
                    totalBalance = totalBalance.add(balance);
                    foundTokenAddress = tokenAddress;
                } else {
                    console.log(`🪙  ${tokenName}: 0.0`);
                    console.log(`    Contract: ${tokenAddress}`);
                }
            } catch (error) {
                console.log(`❌ Error checking ${tokenName} balance at ${tokenAddress}`);
            }
        }

        if (totalBalance.eq(0)) {
            console.log("\n⚠️  You have 0 FXRP balance across all known contracts!");
            if (network === "sepolia") {
                console.log("\n📖 To get FXRP on Sepolia:");
                console.log("   1. Get FTestXRP on Coston2 first");
                console.log("   2. Bridge to Sepolia using bridge-to-sepolia.ts");
                console.log("   See GET_STARTED.md for details");
            } else if (network === "coston2") {
                console.log("\n📖 To get FTestXRP on Coston2:");
                console.log("   1. Get C2FLR from faucet: https://faucet.flare.network/coston2");
                console.log("   2. Mint FTestXRP through FAssets system");
                console.log("   3. See GET_STARTED.md for details");
            }
        } else {
            console.log(`\n✅ Total FXRP Balance: ${ethers.utils.formatUnits(totalBalance, 6)}`);
            console.log(`📍 Your tokens are at: ${foundTokenAddress}`);
        }
    } else {
        console.log(`\nℹ️  FXRP contract not configured for ${network}`);
    }

    console.log("\n═══════════════════════════════════════════════");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
