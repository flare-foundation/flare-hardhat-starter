import 'dotenv/config';

import { EndpointId } from '@layerzerolabs/lz-definitions';
import 'hardhat-deploy';
import '@layerzerolabs/toolbox-hardhat';
import '@nomicfoundation/hardhat-ethers';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-contract-sizer';
import { HardhatUserConfig } from 'hardhat/types';
import { isNotEmpty } from './tasks/common-utils';
import './type-extensions';

import './tasks/common/hardhat-tasks';


const config: HardhatUserConfig = {
    paths: {
        cache: 'cache/hardhat',
    },
    solidity: {
        compilers: [
            {
                version: "0.8.27",
                settings: {
                    evmVersion: "shanghai",
                    optimizer: {
                        enabled: true,
                        runs: 200
                    }
                }
            },
        ],
    },
    networks: {
        'coston2': {
            chainId: 114,
            eid: EndpointId.FLARE_V2_TESTNET,
            url: process.env.COSTON2_RPC || "https://coston2-api.flare.network/ext/C/rpc",
            accounts: [process.env.PRIVATE_KEY, process.env.COSTON2_DEPLOYER_PRIVATE_KEY, process.env.COSTON2_USER_PRIVATE_KEY].filter(isNotEmpty),
            oftAdapter: {
                tokenAddress: '0x8b4abA9C4BD7DD961659b02129beE20c6286e17F', // Coston2 FTestXRP (Legacy)
            },
            redeemComposer: {
                fAssetToken: '0x8b4abA9C4BD7DD961659b02129beE20c6286e17F', // FTestXRP token (Legacy)
                assetManager: '0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA', // AssetManager Testnet XRP
            },
            confirmationsRequired: 2,
            verify: {
                etherscan: {
                    apiUrl: "https://coston2-explorer.flare.network/api",
                    apiKey: "0000",
                }
            }
        },
        'flare': {
            chainId: 14,
            eid: EndpointId.FLARE_V2_MAINNET,
            url: process.env.FLARE_RPC || "https://flare-api.flare.network/ext/C/rpc",
            accounts: [process.env.PRIVATE_KEY, process.env.FLARE_DEPLOYER_PRIVATE_KEY, process.env.FLARE_USER_PRIVATE_KEY].filter(isNotEmpty),
            oftAdapter: {
                tokenAddress: '0xAd552A648C74D49E10027AB8a618A3ad4901c5bE', // Flare FXRP
            },
            confirmationsRequired: 2,
        },
        'sepolia': {
            eid: EndpointId.SEPOLIA_V2_TESTNET,
            url: process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com',
            accounts: [process.env.PRIVATE_KEY, process.env.SEPOLIA_DEPLOYER_PRIVATE_KEY, process.env.SEPOLIA_USER_PRIVATE_KEY].filter(isNotEmpty),
            confirmationsRequired: 6,
        },
        'bscTestnet': {
            eid: EndpointId.BSC_V2_TESTNET,
            url: process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com',
            accounts: [process.env.PRIVATE_KEY, process.env.SEPOLIA_DEPLOYER_PRIVATE_KEY, process.env.SEPOLIA_USER_PRIVATE_KEY].filter(isNotEmpty),
            confirmationsRequired: 6,
        },
        'hyperliquidTestnet': {
            eid: EndpointId.HYPERLIQUID_V2_TESTNET,
            url: process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm',
            accounts: [process.env.PRIVATE_KEY, process.env.SEPOLIA_DEPLOYER_PRIVATE_KEY, process.env.SEPOLIA_USER_PRIVATE_KEY].filter(isNotEmpty),
            confirmationsRequired: 2,
        },
        hardhat: {
            // Need this for testing because TestHelperOz5.sol is exceeding the compiled contract size limit
            allowUnlimitedContractSize: true,
            confirmationsRequired: 1,
        },
    },
    namedAccounts: {
        deployer: {
            default: 0, // wallet address of index[0], of the mnemonic in .env
        },
    },
};

export default config;
