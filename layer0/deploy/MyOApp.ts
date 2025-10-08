import assert from 'assert'

import { type DeployFunction } from 'hardhat-deploy/types'

// Note: If you are using this example to migrate your existing Endpoint V1 OFT to use ULN301, then you should be using the MyEndpointV1OFTV2Mock.ts deploy script instead
// This deploy script is for deploying a generic OApp on Endpoint V2, which is relevant if you want to test out connecting to an LzApp instance that is using ULN301

// Note: declare your contract name here
const contractName = 'MyOApp'

async function deployOApp(hre: any, deployer: string, endpointV2Deployment: any) {
    console.log("\nDeploying OApp...");
    try {
        const { deploy } = hre.deployments
        const { address } = await deploy(contractName, {
            from: deployer,
            args: [
                endpointV2Deployment.address, // LayerZero's EndpointV2 address
                deployer, // LayerZero's delegate address
            ],
            log: true,
            skipIfAlreadyDeployed: false,
        })
        console.log(`OApp deployed to: ${address}`)
        return address
    } catch (error) {
        console.error("Error deploying OApp:", error)
        throw error
    }
}

async function verifyOApp(hre: any, address: string) {
    console.log("\nVerifying contract...");
    try {
        await hre.run("verify:verify", { address })
        console.log("Contract verified successfully")
    } catch (error) {
        console.error("Error verifying contract:", error)
    }
}

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre

    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')

    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)

    // This is an external deployment pulled in from @layerzerolabs/lz-evm-sdk-v2
    //
    // @layerzerolabs/toolbox-hardhat takes care of plugging in the external deployments
    // from @layerzerolabs packages based on the configuration in your hardhat config
    //
    // For this to work correctly, your network config must define an eid property
    // set to `EndpointId` as defined in @layerzerolabs/lz-definitions
    //
    // For example:
    //
    // networks: {
    //   fuji: {
    //     ...
    //     eid: EndpointId.AVALANCHE_V2_TESTNET
    //   }
    // }
    const endpointV2Deployment = await hre.deployments.get('EndpointV2')

    // --- Main Deployment Script ---

    const address = await deployOApp(hre, deployer, endpointV2Deployment)

    console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`)

    // Verify the contract
    await verifyOApp(hre, address)

    console.log("\nDeployment and verification script finished.")
}

deploy.tags = [contractName]

export default deploy