import hre, { run } from "hardhat";
import fs from "fs";
import { CheckpointInstance, PiggyBankInstance } from "../../typechain-types";

const Checkpoint = artifacts.require("Checkpoint");
const PiggyBank = artifacts.require("PiggyBank");

// yarn hardhat run scripts/smartAccounts/deployExampleContracts.ts --network coston2

async function deployAndVerify() {
    const args: any[] = [];
    const checkpoint: CheckpointInstance = await Checkpoint.new(...args);
    const piggyBank: PiggyBankInstance = await PiggyBank.new(...args);
    try {
        await run("verify:verify", {
            address: checkpoint.address,
            constructorArguments: args,
        });
        await run("verify:verify", {
            address: piggyBank.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log(`(${hre.network.name}) Checkpoint deployed to`, checkpoint.address, "\n");
    console.log(`(${hre.network.name}) PiggyBank deployed to`, piggyBank.address, "\n");

    const deployFileContent =
        `export const checkpointAddress = "${checkpoint.address}";\n` +
        `export const piggyBankAddress = "${piggyBank.address}";\n`;
    fs.writeFileSync(`scripts/smartAccounts/deploys.ts`, deployFileContent);
}

void deployAndVerify().then(() => {
    process.exit(0);
});
