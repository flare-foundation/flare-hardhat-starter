import { agencyAddress } from "./config";
import { WeatherIdAgencyInstance } from "../../../typechain-types";

const WeatherIdAgency = artifacts.require("WeatherIdAgency");

// yarn hardhat run scripts/weatherInsurance/WeatherId/claimPolicy.ts --network coston2

const policyId = 0;

async function getPolicyCoverage(
  agency: WeatherIdAgencyInstance,
  policyId: number
) {
  const policy = await agency.registeredPolicies(policyId);
  const policyCoverage = policy.coverage;
  console.log("Policy premium:", policyCoverage, "\n");
  return policyCoverage;
}

async function main() {
  const agency: WeatherIdAgencyInstance = await WeatherIdAgency.at(
    agencyAddress
  );
  console.log("WeatherIdAgency:", agency.address, "\n");

  const policyCoverage = await getPolicyCoverage(agency, policyId);

  const transaction = await agency.claimPolicy(policyId, {
    value: policyCoverage,
  });
  console.log("Transaction:", transaction.tx, "\n");
}

main().then((data) => {
  process.exit(0);
});
