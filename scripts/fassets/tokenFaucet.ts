import { run } from "hardhat";
import { TokenFaucetInstance } from "../../typechain-types";

const TokenFaucet = artifacts.require("TokenFaucet");

// yarn hardhat run scripts/fassets/tokenFaucet.ts --network coston2

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

    console.log("FAssetsSwapAndRedeem deployed to:", tokenFaucetAddress);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
