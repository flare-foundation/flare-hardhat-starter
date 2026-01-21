/**
 * Deploy HyperliquidComposer contract on HyperEVM
 *
 * This contract receives tokens via LayerZero and forwards them to HyperCore.
 *
 * Prerequisites:
 * - HYPE on HyperEVM for gas
 * - FXRP OFT deployed on HyperEVM
 * - Know the system address for the token on Hyperliquid
 *
 * Usage:
 * yarn hardhat run scripts/fassets/deployHyperliquidComposer.ts --network hyperliquidTestnet
 * yarn hardhat run scripts/fassets/deployHyperliquidComposer.ts --network hyperliquid
 */

import { artifacts, run, web3 } from "hardhat";
import { HyperliquidComposerInstance } from "../../typechain-types";

// LayerZero EndpointV2 addresses
const LAYERZERO_ENDPOINTS = {
    hyperliquidTestnet: "0x1a44076050125825900e736c501f859c50fE728c",
    hyperliquid: "0x1a44076050125825900e736c501f859c50fE728c",
} as const;

// FXRP OFT addresses on HyperEVM
// Mainnet: Token index 367, EVM contract from Hyperliquid spotMeta API
const FXRP_OFT_ADDRESSES = {
    hyperliquidTestnet: process.env.HYPERLIQUID_FXRP_OFT || "0x14bfb521e318fc3d5e92A8462C65079BC7d4284c",
    hyperliquid: process.env.HYPERLIQUID_FXRP_OFT_MAINNET || "0xd70659a6396285bf7214d7ea9673184e7c72e07e",
} as const;

// Hyperliquid system addresses for token transfers to HyperCore
// Format: 0x20 + zeros + token_index (big-endian)
// Testnet FXRP: index 1443 = 0x5A3 → system address 0x20000000000000000000000000000000000005a3
// Mainnet FXRP: index 367 = 0x16F → system address 0x200000000000000000000000000000000000016f
const SYSTEM_ADDRESSES = {
    hyperliquidTestnet: process.env.HYPERLIQUID_FXRP_SYSTEM_ADDRESS || "0x20000000000000000000000000000000000005a3",
    hyperliquid: process.env.HYPERLIQUID_FXRP_SYSTEM_ADDRESS_MAINNET || "0x200000000000000000000000000000000000016f",
} as const;

const HyperliquidComposer = artifacts.require("HyperliquidComposer");

type NetworkName = keyof typeof LAYERZERO_ENDPOINTS;

function getNetworkName(): NetworkName {
    const network = process.env.HARDHAT_NETWORK || "hyperliquidTestnet";
    if (network !== "hyperliquidTestnet" && network !== "hyperliquid") {
        throw new Error(`Invalid network: ${network}. Must be hyperliquidTestnet or hyperliquid`);
    }
    return network;
}

function validateConfig(network: NetworkName) {
    const endpoint = LAYERZERO_ENDPOINTS[network];
    const tokenAddress = FXRP_OFT_ADDRESSES[network];
    const systemAddress = SYSTEM_ADDRESSES[network];

    console.log("\n📋 Configuration:");
    console.log("Network:", network);
    console.log("LayerZero Endpoint:", endpoint);
    console.log("FXRP OFT Address:", tokenAddress);
    console.log("System Address:", systemAddress);

    if (!tokenAddress) {
        throw new Error(
            `❌ FXRP OFT address not configured for ${network}!\n` +
                "   Set HYPERLIQUID_FXRP_OFT in .env for testnet or\n" +
                "   HYPERLIQUID_FXRP_OFT_MAINNET for mainnet"
        );
    }

    if (!systemAddress) {
        throw new Error(
            `❌ System address not configured for ${network}!\n` +
                "   Set HYPERLIQUID_FXRP_SYSTEM_ADDRESS in .env for testnet or\n" +
                "   HYPERLIQUID_FXRP_SYSTEM_ADDRESS_MAINNET for mainnet\n\n" +
                "   The system address format is: 0x20 + zeros + token_index (big-endian)\n" +
                "   You need to find the token index for FXRP on Hyperliquid"
        );
    }

    return { endpoint, tokenAddress, systemAddress };
}

async function deployContract(endpoint: string, tokenAddress: string, systemAddress: string) {
    const accounts = await web3.eth.getAccounts();
    console.log("\n🚀 Deploying HyperliquidComposer...");
    console.log("Deployer:", accounts[0]);

    const hyperliquidComposer: HyperliquidComposerInstance = await HyperliquidComposer.new(
        endpoint,
        tokenAddress,
        systemAddress
    );
    const contractAddress = hyperliquidComposer.address;

    console.log(`✅ Deployed at: ${contractAddress}`);
    return contractAddress;
}

async function verifyContract(contractAddress: string, endpoint: string, tokenAddress: string, systemAddress: string) {
    console.log("\n🔍 Verifying...");
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: [endpoint, tokenAddress, systemAddress],
        });
        console.log("✅ Contract verified");
    } catch (e: any) {
        console.log("Verification message:", e.message);
    }
}

async function main() {
    const network = getNetworkName();
    const { endpoint, tokenAddress, systemAddress } = validateConfig(network);

    const address = await deployContract(endpoint, tokenAddress, systemAddress);
    await verifyContract(address, endpoint, tokenAddress, systemAddress);

    console.log("\n📝 Next Steps:");
    console.log("1. Add the composer address to your .env file:");
    console.log(`   HYPERLIQUID_COMPOSER=${address}`);
    console.log("2. Configure the OFT on HyperEVM to use this composer as a peer");
    console.log("3. Use bridgeToHyperCore.ts to bridge tokens from Coston2 to HyperCore");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
