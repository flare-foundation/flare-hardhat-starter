import { agencyAddress } from "./config";
import { WeatherIdAgencyInstance } from "../../../typechain-types";

const WeatherIdAgency = artifacts.require("WeatherIdAgency");

// yarn hardhat run scripts/weatherInsurance/weatherId/createPolicy.ts --network coston2

const latitude = 46.419402127862405;
const longitude = 15.587079308221126;
const apiId = process.env.OPEN_WEATHER_API_KEY ?? "";

const units = "metric";

const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiId}&units=${units}`;

const startTimestamp = Math.round(Date.now() / 1000) + 30;
const expirationTimestamp = startTimestamp + 60 * 60;
const weatherIdThreshold = 800;
const premium = 10;
const coverage = 1000;

async function getWeatherStationCoordinates(apiUrl: string) {
    const response = await fetch(apiUrl, {
        method: "GET",
    });
    const json = await response.json();
    console.log("Response:", json, "\n");
    return json.coord;
}

async function createPolicy(agency: WeatherIdAgencyInstance, policyParameters: any) {
    const transaction = await agency.createPolicy(
        policyParameters.latitude,
        policyParameters.longitude,
        policyParameters.startTimestamp,
        policyParameters.expirationTimestamp,
        policyParameters.weatherIdThreshold,
        policyParameters.coverage,
        { value: policyParameters.premium }
    );
    console.log("Transaction:", transaction.tx, "\n");
}

async function main() {
    const coordinates = await getWeatherStationCoordinates(apiUrl);
    console.log("Coordinates:", coordinates, "\n");

    const policyParameters = {
        latitude: coordinates.lat * 10 ** 6,
        longitude: coordinates.lon * 10 ** 6,
        startTimestamp: startTimestamp,
        expirationTimestamp: expirationTimestamp,
        weatherIdThreshold: weatherIdThreshold,
        coverage: coverage,
        premium: premium,
    };
    console.log("Policy parameters:", policyParameters, "\n");

    const agency: WeatherIdAgencyInstance = await WeatherIdAgency.at(agencyAddress);
    console.log("WeatherIdAgency:", agency.address, "\n");

    await createPolicy(agency, policyParameters);
}

void main().then(() => {
    process.exit(0);
});
