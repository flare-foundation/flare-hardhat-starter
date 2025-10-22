import { generateConnectionsConfig, TwoWayConfig } from "@layerzerolabs/metadata-tools";
import { DVNS, makeContractsConfig, makeTwoWayConfig, SupportedChain } from "./scripts/deploy/wiring";

// With the config generator, pathways declared are automatically bidirectional
// i.e. if you declare A,B there's no need to declare B,A
const pathways: TwoWayConfig[] = [
    makeTwoWayConfig('coston2', 'sepolia', [DVNS.layerZeroLabs]),
];

const deployedChains: SupportedChain[] = ['coston2', 'sepolia'];

export default async function () {
    const connections = await generateConnectionsConfig(pathways);
    const contracts = makeContractsConfig(deployedChains);
    return {
        contracts: contracts,
        connections: connections,
    };
}
