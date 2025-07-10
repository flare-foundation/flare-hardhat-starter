import { run } from "hardhat";
import { TokenFaucetInstance } from "../../../typechain-types";

// yarn hardhat run scripts/fassets/faucet/tokenFaucet.ts --network coston2

const TokenFaucet = artifacts.require("TokenFaucet");

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
