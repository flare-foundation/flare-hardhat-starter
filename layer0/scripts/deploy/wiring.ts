import { EndpointId } from '@layerzerolabs/lz-definitions';
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities';
import { TwoWayConfig } from '@layerzerolabs/metadata-tools';
import type { OAppEnforcedOption, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat';
import hre from "hardhat";
import { requireNotNull } from '../../tasks/common-utils';

export type SupportedChain =
    | 'coston2'                 // Flare testnet
    | 'sepolia'                 // Ethereum testnet
    | 'bscTestnet'              // Binance Smart Chain Testnet
    | 'hyperliquidTestnet';     // Hyperliquid EVM testnet

/**
 *  WARNING: ONLY 1 OFTAdapter should exist for a given global mesh.
 *  The token address for the adapter should be defined in hardhat.config. This will be used in deployment.
 *
 *  for example:
 *
 *    sepolia: {
 *         eid: EndpointId.SEPOLIA_V2_TESTNET,
 *         url: process.env.RPC_URL_SEPOLIA || 'https://rpc.sepolia.org/',
 *         accounts,
 *         oftAdapter: {
 *             tokenAddress: '0x0', // Set the token address for the OFT adapter
 *         },
 *     },
 */
export const CONTRACTS: Record<SupportedChain, OmniPointHardhat> = {
    coston2: {
        eid: EndpointId.FLARE_V2_TESTNET,
        contractName: 'FAssetOFTAdapter',
    },
    sepolia: {
        eid: EndpointId.SEPOLIA_V2_TESTNET,
        contractName: 'FXRPOFT',
    },
    bscTestnet: {
        eid: EndpointId.BSC_V2_TESTNET,
        contractName: 'FXRPOFT',
    },
    hyperliquidTestnet: {
        eid: EndpointId.HYPERLIQUID_V2_TESTNET,
        contractName: 'FXRPOFT',
    }
};

export const DVNS = {
    layerZeroLabs: 'LayerZero Labs',
    nethermind: 'Nethermind',
};

// Define enforced options per specific endpoint ID
export const ENFORCED_OPTIONS: Record<SupportedChain, OAppEnforcedOption[]> = {
    coston2: [
        { msgType: 1, optionType: ExecutorOptionType.LZ_RECEIVE, gas: 210000, value: 0 }
    ],
    sepolia: [
        { msgType: 1, optionType: ExecutorOptionType.LZ_RECEIVE, gas: 100000, value: 0 },
    ],
    bscTestnet: [
        { msgType: 1, optionType: ExecutorOptionType.LZ_RECEIVE, gas: 100000, value: 0 },
    ],
    hyperliquidTestnet: [
        { msgType: 1, optionType: ExecutorOptionType.LZ_RECEIVE, gas: 100000, value: 0 },
    ],
};

export type MakeTwoWayConfigOpts = { twoway?: boolean, confirmations?: [number, number?], optionalDVNs?: [dvns: string[], threshold: number] };

export function makeTwoWayConfig(sourceChain: SupportedChain, targetChain: SupportedChain, requiredDVNs: string[], opts: MakeTwoWayConfigOpts = {}): TwoWayConfig {
    const twoway = opts.twoway ?? true;
    const confirmations = requireNotNull(opts.confirmations?.[0] ?? hre.userConfig.networks?.[sourceChain]?.confirmationsRequired);
    const confirmationsBack = twoway ? requireNotNull(opts.confirmations?.[1] ?? hre.userConfig.networks?.[targetChain]?.confirmationsRequired) : undefined;
    const optionalDVNs = opts.optionalDVNs ?? [];
    return [
        CONTRACTS[sourceChain], // Chain A contract
        CONTRACTS[targetChain], // Chain B contract
        [requiredDVNs, optionalDVNs], // [ requiredDVN[], [ optionalDVN[], threshold ] ]
        [confirmations, confirmationsBack], // [A to B confirmations, B to A confirmations]
        [ENFORCED_OPTIONS[targetChain], ENFORCED_OPTIONS[sourceChain]], // Chain B enforcedOptions, Chain A enforcedOptions
    ];
}

export function makeContractsConfig(deployedChains: SupportedChain[]) {
    return (Object.keys(CONTRACTS) as SupportedChain[])
        .filter(chain => deployedChains.includes(chain))
        .map(chain => ({ contract: CONTRACTS[chain] }));
}
