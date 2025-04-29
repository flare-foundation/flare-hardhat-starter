import { agencyAddress } from "./config";
import { WeatherIdAgencyInstance } from "../../../typechain-types";

const WeatherIdAgency = artifacts.require("WeatherIdAgency");

// yarn hardhat run scripts/weatherInsurance/weatherId/retireUnclaimedPolicy.ts --network coston2

const policyId = 1;

async function main() {
    const agency: WeatherIdAgencyInstance = await WeatherIdAgency.at(agencyAddress);
    console.log("WeatherIdAgency:", agency.address, "\n");

    const transaction = await agency.retireUnclaimedPolicy(policyId);
    console.log("Transaction:", transaction.tx, "\n");
}

void main().then(() => {
    process.exit(0);
});
