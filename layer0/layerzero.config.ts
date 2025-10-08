import { EndpointId } from '@layerzerolabs/lz-definitions';
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities';
import type { OAppOmniGraphHardhat, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat';

// ------------------- OApp Contract Definitions -------------------
// NOTE: You must update contractNames to match your contract artifacts.
// NOTE: You must update the Solana address after deployment.

const sepoliaContract: OmniPointHardhat = {
    eid: EndpointId.SEPOLIA_TESTNET,
    contractName: 'MyEndpointV1OFTV2Mock',
};

const solanaContract: OmniPointHardhat = {
    eid: EndpointId.SOLANA_V2_TESTNET,
    address: '', // NOTE: update this with the OFTStore address.
};

// Mainnet configuration based on the live data from LayerZero Scan.
const flareContract: OmniPointHardhat = {
    eid: 30295, // Live Endpoint ID for Flare Mainnet
    contractName: 'MyOApp', // TODO: Update with your contract name for Flare
};

// Testnet configuration based on the live data from LayerZero Scan.
const coston2Contract: OmniPointHardhat = {
    eid: 40294, // Live Endpoint ID for Coston2 Testnet
    contractName: 'MyOApp', // TODO: Update with your contract name for Coston2
};

// ------------------- Main OAppOmniGraphHardhat Configuration -------------------
const config: OAppOmniGraphHardhat = {
    contracts: [
        { contract: sepoliaContract },
        { contract: solanaContract },
        { contract: flareContract },
        { contract: coston2Contract },
    ],
    connections: [
        // ---------- Existing Solana Connections (Unchanged) ----------
        {
            from: sepoliaContract,
            to: solanaContract,
            config: {
                sendLibrary: '0x6862b19f6e42a810946B9C782E6ebE26Ad266C84',
                receiveLibraryConfig: {
                    receiveLibrary: '0x5937A5fe272fbA38699A1b75B3439389EEFDb399',
                    gracePeriod: BigInt(0),
                },
                sendConfig: {
                    executorConfig: {
                        maxMessageSize: 200,
                        executor: '0x718B92b5CB0a5552039B593faF724D182A881eDA',
                    },
                    ulnConfig: {
                        confirmations: BigInt(15),
                        requiredDVNs: ['0x8eebf8b423b73bfca51a1db4b7354aa0bfca9193'],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                receiveConfig: {
                    ulnConfig: {
                        confirmations: BigInt(32),
                        requiredDVNs: ['0x8eebf8b423b73bfca51a1db4b7354aa0bfca9193'],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
            },
        },
        {
            from: solanaContract,
            to: sepoliaContract,
            config: {
                sendLibrary: '7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH',
                receiveLibraryConfig: {
                    receiveLibrary: '7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH',
                    gracePeriod: BigInt(0),
                },
                sendConfig: {
                    executorConfig: {
                        maxMessageSize: 10000,
                        executor: 'AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK',
                    },
                    ulnConfig: {
                        confirmations: BigInt(32),
                        requiredDVNs: ['4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb'],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                receiveConfig: {
                    ulnConfig: {
                        confirmations: BigInt(15),
                        requiredDVNs: ['4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb'],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                enforcedOptions: [
                    { msgType: 1, optionType: ExecutorOptionType.LZ_RECEIVE, gas: 200000 },
                    { msgType: 2, optionType: ExecutorOptionType.LZ_RECEIVE, gas: 200000 },
                ],
            },
        },

        // ---------- Fully Configured EVM Connections ----------

        // Sepolia <-> Flare
        {
            from: sepoliaContract,
            to: flareContract,
            config: {
                sendConfig: {
                    ulnConfig: {
                        confirmations: BigInt(15),
                        requiredDVNs: ['0x8eebf8b423b73bfca51a1db4b7354aa0bfca9193'],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                receiveConfig: {
                    ulnConfig: {
                        confirmations: BigInt(15),
                        requiredDVNs: ['0x8eebf8b73bfca51a1db4b7354aa0bfca9193'],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
            },
        },
        {
            from: flareContract,
            to: sepoliaContract,
            config: {
                sendConfig: {
                    executorConfig: {
                        maxMessageSize: 10000,
                        executor: '0xcCE466a522984415bC91338c232d98869193D46e',
                    },
                    ulnConfig: {
                        confirmations: BigInt(30),
                        requiredDVNs: [
                            '0x9c061c9a4782294eef65ef28cb88233a987f4bdd', // LayerZero Labs DVN
                            '0x8ddf05f9a5c488b4973897e278b58895bf87cb24', // Polyhedra zkBridge DVN
                        ],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                receiveConfig: {
                    ulnConfig: {
                        confirmations: BigInt(30),
                        requiredDVNs: [
                            '0x9c061c9a4782294eef65ef28cb88233a987f4bdd', // LayerZero Labs DVN
                            '0x8ddf05f9a5c488b4973897e278b58895bf87cb24', // Polyhedra zkBridge DVN
                        ],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
            },
        },

        // Sepolia <-> Coston2
        {
            from: sepoliaContract,
            to: coston2Contract,
            config: {
                sendConfig: {
                    ulnConfig: {
                        confirmations: BigInt(15),
                        requiredDVNs: ['0x8eebf8b423b73bfca51a1db4b7354aa0bfca9193'],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                receiveConfig: {
                    ulnConfig: {
                        confirmations: BigInt(15),
                        requiredDVNs: ['0x8eebf8b423b73bfca51a1db4b7354aa0bfca9193'],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
            },
        },
        {
            from: coston2Contract,
            to: sepoliaContract,
            config: {
                sendConfig: {
                    executorConfig: {
                        maxMessageSize: 10000,
                        executor: '0x9dB9Ca3305B48F196D18082e91cB64663b13d014',
                    },
                    ulnConfig: {
                        confirmations: BigInt(15),
                        // 🛑 TODO: This path is NON-FUNCTIONAL.
                        // The Coston2 endpoint 40294 currently has no registered DVNs.
                        // You must find a DVN from the Flare/LayerZero team and add it here to enable this path.
                        requiredDVNs: ['INSERT_VALID_COSTON2_DVN_ADDRESS_HERE'],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                receiveConfig: {
                    ulnConfig: {
                        confirmations: BigInt(15),
                        requiredDVNs: ['INSERT_VALID_COSTON2_DVN_ADDRESS_HERE'],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
            },
        },

        // Flare <-> Coston2
        {
            from: flareContract,
            to: coston2Contract,
            config: {
                sendConfig: {
                    executorConfig: {
                        maxMessageSize: 10000,
                        executor: '0xcCE466a522984415bC91338c232d98869193D46e',
                    },
                    ulnConfig: {
                        confirmations: BigInt(30),
                        requiredDVNs: [
                            '0x9c061c9a4782294eef65ef28cb88233a987f4bdd', // LayerZero Labs DVN
                            '0x8ddf05f9a5c488b4973897e278b58895bf87cb24', // Polyhedra zkBridge DVN
                        ],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                receiveConfig: {
                    ulnConfig: {
                        confirmations: BigInt(30),
                        requiredDVNs: [
                            '0x9c061c9a4782294eef65ef28cb88233a987f4bdd', // LayerZero Labs DVN
                            '0x8ddf05f9a5c488b4973897e278b58895bf87cb24', // Polyhedra zkBridge DVN
                        ],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
            },
        },
        {
            from: coston2Contract,
            to: flareContract,
            config: {
                sendConfig: {
                    executorConfig: {
                        maxMessageSize: 10000,
                        executor: '0x9dB9Ca3305B48F196D18082e91cB64663b13d014',
                    },
                    ulnConfig: {
                        confirmations: BigInt(15),
                        // 🛑 TODO: This path is NON-FUNCTIONAL.
                        // The Coston2 endpoint 40294 currently has no registered DVNs.
                        // You must find a DVN from the Flare/LayerZero team and add it here to enable this path.
                        requiredDVNs: ['INSERT_VALID_COSTON2_DVN_ADDRESS_HERE'],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                receiveConfig: {
                    ulnConfig: {
                        confirmations: BigInt(15),
                        requiredDVNs: ['INSERT_VALID_COSTON2_DVN_ADDRESS_HERE'],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
            },
        },
    ],
};

export default config;