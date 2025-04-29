import "@nomicfoundation/hardhat-verify";
import { ethers, run } from "hardhat";
import { SimpleFtsoExampleContract } from "../typechain-types";
const SimpleFtsoExample: SimpleFtsoExampleContract = artifacts.require("SimpleFtsoExample");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    const args: any[] = [];
    const simpleFtsoExample = await SimpleFtsoExample.new(...args);
    console.log("SimpleFtsoExample deployed to:", simpleFtsoExample.address);
    try {
        const result = await run("verify:verify", {
            address: simpleFtsoExample.address,
            constructorArguments: args,
        });

        console.log(result);
    } catch (e: any) {
        console.log(e.message);
    }
    console.log("Deployed contract at:", simpleFtsoExample.address);
}
void main().then(() => process.exit(0));
