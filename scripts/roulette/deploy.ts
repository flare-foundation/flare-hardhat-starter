import { run, web3 } from "hardhat";
import { writeFileSync } from "fs";
import { join } from "path";
import { RouletteInstance } from "../../typechain-types";

const Roulette = artifacts.require("Roulette");

// yarn hardhat run scripts/roulette/deploy.ts --network coston2

const DEPLOYS_FILE = join(__dirname, "deploys.ts");

function writeDeploysFile(address: string) {
    const content =
        "// Auto-written by scripts/roulette/deploy.ts after a successful deploy.\n" +
        "// Do not edit by hand — re-run the deploy script to update.\n" +
        `export const rouletteAddress = "${address}";\n`;
    writeFileSync(DEPLOYS_FILE, content);
    console.log("Wrote", DEPLOYS_FILE);
}

async function deployAndVerify() {
    const [deployer] = await web3.eth.getAccounts();
    const args: any[] = [deployer];
    const roulette: RouletteInstance = await Roulette.new(...args);
    writeDeploysFile(roulette.address);
    try {
        await run("verify:verify", {
            address: roulette.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log("Roulette deployed to", roulette.address);
}

void deployAndVerify().then(() => {
    process.exit(0);
});
