import { agencyAddress } from "./config";
import { WeatherIdAgencyInstance } from "../../../typechain-types";

const WeatherIdAgency = artifacts.require("WeatherIdAgency");

// yarn hardhat run scripts/weatherInsurance/weatherId/expirePolicy.ts --network coston2

const policyId = 0;

async function main() {
    const agency: WeatherIdAgencyInstance = await WeatherIdAgency.at(agencyAddress);
    console.log("WeatherIdAgency:", agency.address, "\n");

    const transaction = await agency.expirePolicy(policyId);
    console.log("Transaction:", transaction.tx, "\n");
}

void main().then(() => {
    process.exit(0);
});
