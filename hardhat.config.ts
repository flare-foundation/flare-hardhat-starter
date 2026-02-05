import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-web3";
import "@tenderly/hardhat-tenderly";
require("@nomiclabs/hardhat-truffle5");
// import { vars } from "hardhat/config";
const { vars } = require("hardhat/config");
require("dotenv").config();

// Load environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const FLARE_RPC_API_KEY = process.env.FLARE_RPC_API_KEY ?? "";
const FLARE_EXPLORER_API_KEY = process.env.FLARE_EXPLORER_API_KEY ?? "";

// Explorer URLs (Blockscout) — override via env vars if needed
const COSTON_EXPLORER_URL = process.env.COSTON_EXPLORER_URL ?? "https://coston-explorer.flare.network";
const COSTON2_EXPLORER_URL = process.env.COSTON2_EXPLORER_URL ?? "https://coston2-explorer.flare.network";
const SONGBIRD_EXPLORER_URL = process.env.SONGBIRD_EXPLORER_URL ?? "https://songbird-explorer.flare.network";
const FLARE_EXPLORER_URL = process.env.FLARE_EXPLORER_URL ?? "https://flare-explorer.flare.network";

const COSTON_RPC_URL = process.env.COSTON_RPC_URL ?? "";
const COSTON2_RPC_URL = process.env.COSTON2_RPC_URL ?? "";
const SONGBIRD_RPC_URL = process.env.SONGBIRD_RPC_URL ?? "";
const FLARE_RPC_URL = process.env.FLARE_RPC_URL ?? "";
const XRPLEVM_RPC_URL_TESTNET = process.env.XRPLEVM_RPC_URL_TESTNET ?? "";

const VERIFIER_API_KEY_TESTNET = process.env.VERIFIER_API_KEY_TESTNET ?? "";

const TENDERLY_USERNAME = process.env.TENDERLY_USERNAME ?? "";
const TENDERLY_PROJECT_SLUG = process.env.TENDERLY_PROJECT_SLUG ?? "";

const XRPLEVM_EXPLORER_URL_TESTNET = process.env.XRPLEVM_EXPLORER_URL_TESTNET ?? "";

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.8.25",
                settings: {
                    evmVersion: "cancun",
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    networks: {
        sepolia: {
            url: "https://rpc.ankr.com/eth_sepolia",
            accounts: [`${PRIVATE_KEY}`],
        },
        coston: {
            url: FLARE_RPC_API_KEY
                ? `https://coston-api-tracer.flare.network/ext/C/rpc?x-apikey=${FLARE_RPC_API_KEY}`
                : "https://coston-api.flare.network/ext/C/rpc",
            accounts: [`${PRIVATE_KEY}`],
            chainId: 16,
        },
        coston2: {
            url: FLARE_RPC_API_KEY
                ? `https://coston2-api-tracer.flare.network/ext/C/rpc?x-apikey=${FLARE_RPC_API_KEY}`
                : "https://coston2-api.flare.network/ext/C/rpc",
            accounts: [`${PRIVATE_KEY}`],
            chainId: 114,
        },
        songbird: {
            url: FLARE_RPC_API_KEY
                ? `https://songbird-api-tracer.flare.network/ext/C/rpc?x-apikey=${FLARE_RPC_API_KEY}`
                : "https://songbird-api.flare.network/ext/C/rpc",
            accounts: [`${PRIVATE_KEY}`],
            chainId: 19,
        },
        flare: {
            url: FLARE_RPC_API_KEY
                ? `https://flare-api-tracer.flare.network/ext/C/rpc?x-apikey=${FLARE_RPC_API_KEY}`
                : "https://flare-api.flare.network/ext/C/rpc",
            accounts: [`${PRIVATE_KEY}`],
            chainId: 14,
        },
        hyperliquidTestnet: {
            url: "https://rpc.hyperliquid-testnet.xyz/evm",
            accounts: [`${PRIVATE_KEY}`],
            chainId: 998,
        },
        hyperliquid: {
            url: "https://rpc.hyperliquid.xyz/evm",
            accounts: [`${PRIVATE_KEY}`],
            chainId: 999,
        },
        tenderly: {
            url: "https://flare.gateway.tenderly.co/pdYQcL54puW9QXPURLblM",
            accounts: [`${PRIVATE_KEY}`],
            chainId: 14,
        },
        xrplEVMTestnet: {
            url: `${XRPLEVM_RPC_URL_TESTNET}`,
            accounts: [`${PRIVATE_KEY}`],
            chainId: 1449000,
        },
    },
    etherscan: {
        apiKey: {
            coston: `${FLARE_EXPLORER_API_KEY}`,
            coston2: `${FLARE_EXPLORER_API_KEY}`,
            songbird: `${FLARE_EXPLORER_API_KEY}`,
            flare: `${FLARE_EXPLORER_API_KEY}`,
            xrplEVMTestnet: "testnet-key",
        },
        customChains: [
            {
                network: "coston",
                chainId: 16,
                urls: {
                    // faucet: https://faucet.towolabs.com/
                    apiURL:
                        `${COSTON_EXPLORER_URL}/api` +
                        (FLARE_EXPLORER_API_KEY ? `?x-apikey=${FLARE_EXPLORER_API_KEY}` : ""), // Must not have / endpoint
                    browserURL: COSTON_EXPLORER_URL,
                },
            },
            {
                network: "coston2",
                chainId: 114,
                urls: {
                    // faucet: https://coston2-faucet.towolabs.com/
                    apiURL:
                        `${COSTON2_EXPLORER_URL}/api` +
                        (FLARE_EXPLORER_API_KEY ? `?x-apikey=${FLARE_EXPLORER_API_KEY}` : ""), // Must not have / endpoint
                    browserURL: COSTON2_EXPLORER_URL,
                },
            },
            {
                network: "songbird",
                chainId: 19,
                urls: {
                    apiURL:
                        `${SONGBIRD_EXPLORER_URL}/api` +
                        (FLARE_EXPLORER_API_KEY ? `?x-apikey=${FLARE_EXPLORER_API_KEY}` : ""), // Must not have / endpoint
                    browserURL: SONGBIRD_EXPLORER_URL,
                },
            },
            {
                network: "flare",
                chainId: 14,
                urls: {
                    apiURL:
                        `${FLARE_EXPLORER_URL}/api` +
                        (FLARE_EXPLORER_API_KEY ? `?x-apikey=${FLARE_EXPLORER_API_KEY}` : ""), // Must not have / endpoint
                    browserURL: FLARE_EXPLORER_URL,
                },
            },
            {
                network: "xrplEVMTestnet",
                chainId: 1449000,
                urls: {
                    apiURL: XRPLEVM_EXPLORER_URL_TESTNET + "api",
                    browserURL: XRPLEVM_EXPLORER_URL_TESTNET,
                },
            },
        ],
    },
    paths: {
        sources: "./contracts/",
        tests: "./test/",
        cache: "./cache",
        artifacts: "./artifacts",
    },
    typechain: {
        target: "truffle-v5",
    },
    tenderly: {
        username: TENDERLY_USERNAME,
        project: TENDERLY_PROJECT_SLUG,
    },
};

export default config;
