import { agencyAddress } from "./config";
import { MinTempAgencyInstance } from "../../../typechain-types";

const MinTempAgency = artifacts.require("MinTempAgency");

// yarn hardhat run scripts/weatherInsurance/minTemp/retireUnclaimedPolicy.ts --network coston2

const policyId = 0;

async function main() {
    const agency: MinTempAgencyInstance = await MinTempAgency.at(agencyAddress);
    console.log("MinTempAgency:", agency.address, "\n");

    const transaction = await agency.retireUnclaimedPolicy(policyId);
    console.log("Transaction:", transaction.tx, "\n");
}

void main().then(() => {
    process.exit(0);
});
