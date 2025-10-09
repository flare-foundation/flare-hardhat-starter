import { EndpointId } from '@layerzerolabs/lz-definitions';
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities';
import type { OAppOmniGraphHardhat, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat';

// ------------------- OApp Contract Definitions -------------------
// NOTE: You must update contractNames to match your contract artifacts.
// NOTE: You must update the Solana address after deployment.

// Mainnet Contracts
const ethereumContract: OmniPointHardhat = {
    eid: EndpointId.ETHEREUM_V2_MAINNET,
    contractName: 'MyOApp',
};

const flareContract: OmniPointHardhat = {
    eid: EndpointId.FLARE_V2_MAINNET,
    contractName: 'MyOApp',
};

// // Testnet Contracts
// const sepoliaContract: OmniPointHardhat = {
//     eid: EndpointId.SEPOLIA_V2_TESTNET,
//     contractName: 'MyOApp',
// };

// const coston2Contract: OmniPointHardhat = {
//     eid: EndpointId.FLARE_V2_TESTNET,
//     contractName: 'MyOApp',
// };


// ------------------- Main OAppOmniGraphHardhat Configuration -------------------
const config: OAppOmniGraphHardhat = {
    contracts: [
        // Mainnet
        { contract: ethereumContract },
        { contract: flareContract },
        // Testnet
        // { contract: sepoliaContract },
        // { contract: coston2Contract },
    ],
    connections: [
        // ---------- Fully Configured EVM Connections ----------

        // Sepolia <-> Flare
        {
            from: ethereumContract,
            to: flareContract,
            config: {
                sendConfig: {
                    executorConfig: {
                        maxMessageSize: 10000,
                        executor: '0x173272739Bd7Aa6e4e214714048a9fE699453059',
                    },
                    ulnConfig: {
                        confirmations: BigInt(15),
                        requiredDVNs: ['0x589dedbd617e0cbcb916a9223f4d1300c294236b'],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                receiveConfig: {
                    ulnConfig: {
                        confirmations: BigInt(15),
                        requiredDVNs: ['0x589dedbd617e0cbcb916a9223f4d1300c294236b'],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
            },
        },
        {
            from: flareContract,
            to: ethereumContract,
            config: {
                sendConfig: {
                    executorConfig: {
                        maxMessageSize: 10000,
                        executor: '0xcCE466a522984415bC91338c232d98869193D46e',
                    },
                    ulnConfig: {
                        confirmations: BigInt(30),
                        requiredDVNs: [
                            '0x9c061c9a4782294eef65ef28cb88233a987f4bdd'
                        ],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                receiveConfig: {
                    ulnConfig: {
                        confirmations: BigInt(30),
                        requiredDVNs: [
                            '0x9c061c9a4782294eef65ef28cb88233a987f4bdd',
                        ],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
            },
        },

        // Sepolia <-> Coston2
        // {
        //     from: sepoliaContract,
        //     to: coston2Contract,
        //     config: {
        //         sendConfig: {
        //             ulnConfig: {
        //                 confirmations: BigInt(15),
        //                 requiredDVNs: ['0x8eebf8b423b73bfca51a1db4b7354aa0bfca9193'],
        //                 optionalDVNs: [],
        //                 optionalDVNThreshold: 0,
        //             },
        //         },
        //         receiveConfig: {
        //             ulnConfig: {
        //                 confirmations: BigInt(15),
        //                 requiredDVNs: ['0x8eebf8b423b73bfca51a1db4b7354aa0bfca9193'],
        //                 optionalDVNs: [],
        //                 optionalDVNThreshold: 0,
        //             },
        //         },
        //     },
        // },
        // {
        //     from: coston2Contract,
        //     to: sepoliaContract,
        //     config: {
        //         sendConfig: {
        //             executorConfig: {
        //                 maxMessageSize: 10000,
        //                 executor: '0x9dB9Ca3305B48F196D18082e91cB64663b13d014',
        //             },
        //             ulnConfig: {
        //                 confirmations: BigInt(15),
        //                 // 🛑 TODO: This path is NON-FUNCTIONAL.
        //                 // The Coston2 endpoint 40294 currently has no registered DVNs.
        //                 // You must find a DVN from the Flare/LayerZero team and add it here to enable this path.
        //                 requiredDVNs: ['INSERT_VALID_COSTON2_DVN_ADDRESS_HERE'],
        //                 optionalDVNs: [],
        //                 optionalDVNThreshold: 0,
        //             },
        //         },
        //         receiveConfig: {
        //             ulnConfig: {
        //                 confirmations: BigInt(15),
        //                 requiredDVNs: ['INSERT_VALID_COSTON2_DVN_ADDRESS_HERE'],
        //                 optionalDVNs: [],
        //                 optionalDVNThreshold: 0,
        //             },
        //         },
        //     },
        // },

        // Flare <-> Coston2
        // {
        //     from: flareContract,
        //     to: coston2Contract,
        //     config: {
        //         sendConfig: {
        //             executorConfig: {
        //                 maxMessageSize: 10000,
        //                 executor: '0xcCE466a522984415bC91338c232d98869193D46e',
        //             },
        //             ulnConfig: {
        //                 confirmations: BigInt(30),
        //                 requiredDVNs: [
        //                     '0x9c061c9a4782294eef65ef28cb88233a987f4bdd', // LayerZero Labs DVN
        //                     '0x8ddf05f9a5c488b4973897e278b58895bf87cb24', // Polyhedra zkBridge DVN
        //                 ],
        //                 optionalDVNs: [],
        //                 optionalDVNThreshold: 0,
        //             },
        //         },
        //         receiveConfig: {
        //             ulnConfig: {
        //                 confirmations: BigInt(30),
        //                 requiredDVNs: [
        //                     '0x9c061c9a4782294eef65ef28cb88233a987f4bdd', // LayerZero Labs DVN
        //                     '0x8ddf05f9a5c488b4973897e278b58895bf87cb24', // Polyhedra zkBridge DVN
        //                 ],
        //                 optionalDVNs: [],
        //                 optionalDVNThreshold: 0,
        //             },
        //         },
        //     },
        // },
        // {
        //     from: coston2Contract,
        //     to: flareContract,
        //     config: {
        //         sendConfig: {
        //             executorConfig: {
        //                 maxMessageSize: 10000,
        //                 executor: '0x9dB9Ca3305B48F196D18082e91cB64663b13d014',
        //             },
        //             ulnConfig: {
        //                 confirmations: BigInt(15),
        //                 // 🛑 TODO: This path is NON-FUNCTIONAL.
        //                 // The Coston2 endpoint 40294 currently has no registered DVNs.
        //                 // You must find a DVN from the Flare/LayerZero team and add it here to enable this path.
        //                 requiredDVNs: ['INSERT_VALID_COSTON2_DVN_ADDRESS_HERE'],
        //                 optionalDVNs: [],
        //                 optionalDVNThreshold: 0,
        //             },
        //         },
        //         receiveConfig: {
        //             ulnConfig: {
        //                 confirmations: BigInt(15),
        //                 requiredDVNs: ['INSERT_VALID_COSTON2_DVN_ADDRESS_HERE'],
        //                 optionalDVNs: [],
        //                 optionalDVNThreshold: 0,
        //             },
        //         },
        //     },
        // },
    ],
};

export default config;