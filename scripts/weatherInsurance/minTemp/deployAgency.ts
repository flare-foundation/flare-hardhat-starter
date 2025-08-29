import hre, { run } from "hardhat";
import fs from "fs";
import { MinTempAgencyInstance } from "../../../typechain-types";

const MinTempAgency = artifacts.require("MinTempAgency");

// yarn hardhat run scripts/weatherInsurance/minTemp/deployAgency.ts --network coston2

async function deployAndVerify() {
    const args: any[] = [];
    const agency: MinTempAgencyInstance = await MinTempAgency.new(...args);
    try {
        await run("verify:verify", {
            address: agency.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log(`(${hre.network.name}) MinTempAgency deployed to`, agency.address, "\n");

    fs.writeFileSync(`scripts/weatherInsurance/minTemp/config.ts`, `export const agencyAddress = "${agency.address}";`);
}

void deployAndVerify().then(() => {
    process.exit(0);
});
