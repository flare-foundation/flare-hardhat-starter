import hre, { run } from "hardhat";
import { WeatherIdAgencyInstance } from "../../../typechain-types";

const WeatherIdAgency = artifacts.require("WeatherIdAgency");

// yarn hardhat run scripts/weatherInsurance/weatherId/deployAgency.ts --network coston2

async function deployAndVerify() {
    const args: any[] = [];
    const agency: WeatherIdAgencyInstance = await WeatherIdAgency.new(...args);
    try {
        await run("verify:verify", {
            address: agency.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log(`(${hre.network.name}) WeatherIdAgency deployed to`, agency.address, "\n");
}

void deployAndVerify().then(() => {
    process.exit(0);
});
