import { run } from "hardhat";
import { TokenFaucetInstance, IAssetManagerInstance } from "../../typechain-types";

// yarn hardhat run scripts/fassets/tokenFaucet.ts --network coston2

const TokenFaucet = artifacts.require("TokenFaucet");
const IAssetManager = artifacts.require("IAssetManager");

// AssetManager address on Flare Testnet Coston2 network
const ASSET_MANAGER_ADDRESS = "0xDeD50DA9C3492Bee44560a4B35cFe0e778F41eC5";

async function main() {
    const tokenFaucet: TokenFaucetInstance = await TokenFaucet.new();
    const tokenFaucetAddress = await tokenFaucet.address;

    try {
        await run("verify:verify", {
            address: tokenFaucetAddress,
            constructorArguments: [],
        });
    } catch (e: any) {
        console.log(e);
    }

    console.log("TokenFaucet deployed to:", tokenFaucetAddress);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
