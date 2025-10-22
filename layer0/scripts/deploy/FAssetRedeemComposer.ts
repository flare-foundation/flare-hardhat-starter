import { EndpointId, endpointIdToNetwork } from '@layerzerolabs/lz-definitions';
import { getDeploymentAddressAndAbi } from '@layerzerolabs/lz-evm-sdk-v2';
import assert from 'assert';

import { type DeployFunction } from 'hardhat-deploy/types';

const contractName = 'FAssetRedeemComposer';

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre;

    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    assert(deployer, 'Missing named deployer account');
    console.log(`Deployer: ${deployer}`);

    const eid = hre.network.config.eid as EndpointId;
    const lzNetworkName = endpointIdToNetwork(eid);

    console.log(`Network: ${hre.network.name}`);
    console.log(`LZ Network: ${lzNetworkName}`);

    // Get LayerZero endpoint
    const endpointV2Deployment = getDeploymentAddressAndAbi(lzNetworkName, 'EndpointV2');

    // Check if redeemComposer config exists in network config
    if (hre.network.config.redeemComposer == null) {
        console.warn(`redeemComposer not configured on network config, skipping FAssetRedeemComposer deployment`);
        console.warn(`Add the following to your network config in hardhat.config.ts:`);
        console.warn(`redeemComposer: {`);
        console.warn(`    fAssetToken: "0x...", // FAsset token address (e.g., FTestXRP)`);
        console.warn(`    assetManager: "0x...", // AssetManager contract address`);
        console.warn(`}`);
        return;
    }

    const { fAssetToken, assetManager } = hre.network.config.redeemComposer;

    assert(fAssetToken, 'fAssetToken address not configured in redeemComposer');
    assert(assetManager, 'assetManager address not configured in redeemComposer');

    console.log(`FAsset Token: ${fAssetToken}`);
    console.log(`Asset Manager: ${assetManager}`);

    const { address } = await deploy(contractName, {
        from: deployer,
        args: [
            endpointV2Deployment.address, // LayerZero EndpointV2 address
            fAssetToken, // FAsset token address (e.g., FTestXRP)
            assetManager, // AssetManager contract address
        ],
        log: true,
        skipIfAlreadyDeployed: false,
        waitConfirmations: hre.network.config.confirmationsRequired,
    });

    console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`);
    console.log(`\nIMPORTANT: Set this address as COSTON2_COMPOSER in your .env file:`);
    console.log(`COSTON2_COMPOSER=${address}`);
};

deploy.tags = [contractName];

export default deploy;
