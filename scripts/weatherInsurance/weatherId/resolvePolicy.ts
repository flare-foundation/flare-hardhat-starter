import { agencyAddress } from "./config";
import { WeatherIdAgencyInstance } from "../../../typechain-types";
import {
    prepareAttestationRequestBase,
    submitAttestationRequest,
    retrieveDataAndProofBase,
    sleep,
} from "../../fdcExample/Base";

const { JQ_VERIFIER_URL_TESTNET, JQ_VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

const WeatherIdAgency = artifacts.require("WeatherIdAgency");

// yarn hardhat run scripts/weatherInsurance/weatherId/resolvePolicy.ts --network coston2

const policyId = 0;

// Request data
const apiId = process.env.OPEN_WEATHER_API_KEY ?? "";
const units = "metric";

const postprocessJq = `{
latitude: (.coord.lat | if . != null then .*pow(10;6) else null end),
longitude: (.coord.lon | if . != null then .*pow(10;6) else null end),
weatherId: .weather[0].id,
weatherMain: .weather[0].main,
description: .weather[0].description,
temperature: (.main.temp | if . != null then .*pow(10;6) else null end),
windSpeed: (.wind.speed | if . != null then . *pow(10;6) end),
windDeg: .wind.deg
}`;

const abiSignature = `{
          "components": [
            {
              "internalType": "int256",
              "name": "latitude",
              "type": "int256"
            },
            {
              "internalType": "int256",
              "name": "longitude",
              "type": "int256"
            },
            {
              "internalType": "uint256",
              "name": "weatherId",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "weatherMain",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "description",
              "type": "string"
            },
            {
              "internalType": "uint256",
              "name": "temperature",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "windSpeed",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "windDeg",
              "type": "uint256"
            }
          ],
          "name": "dto",
          "type": "tuple"
        }`;

// Configuration constants
const attestationTypeBase = "IJsonApi";
const sourceIdBase = "WEB2";
const verifierUrlBase = JQ_VERIFIER_URL_TESTNET;

async function getPolicy(agency: WeatherIdAgencyInstance, id: number) {
    const response = await agency.registeredPolicies(id);
    const policy = {
        latitude: response.latitude,
        longitude: response.longitude,
        startTimestamp: response.startTimestamp,
        expirationTimestamp: response.expirationTimestamp,
        minTempThreshold: response.minTempThreshold,
        premium: response.premium,
        coverage: response.coverage,
        status: response.status,
        id: response.id,
    };
    console.log("Policy:", policy, "\n");
    return policy;
}

function prepareUrl(policy: any) {
    return `https://api.openweathermap.org/data/2.5/weather?lat=${
        policy.latitude / 10 ** 6
    }&lon=${policy.longitude / 10 ** 6}&units=${units}&appid=${apiId}`;
}

async function prepareAttestationRequest(apiUrl: string, postprocessJq: string, abiSignature: string) {
    const requestBody = {
        url: apiUrl,
        postprocessJq: postprocessJq,
        abi_signature: abiSignature,
    };

    const url = `${verifierUrlBase}JsonApi/prepareRequest`;
    const apiKey = JQ_VERIFIER_API_KEY_TESTNET;

    return await prepareAttestationRequestBase(url, apiKey, attestationTypeBase, sourceIdBase, requestBody);
}

async function retrieveDataAndProof(abiEncodedRequest: string, roundId: number) {
    const url = `${COSTON2_DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
    console.log("Url:", url, "\n");
    return await retrieveDataAndProofBase(url, abiEncodedRequest, roundId);
}

async function resolvePolicy(agency: WeatherIdAgencyInstance, id: number, proof: any) {
    // A piece of black magic that allows us to read the response type from an artifact
    const IJsonApiVerification = await artifacts.require("IJsonApiVerification");
    const responseType = IJsonApiVerification._json.abi[0].inputs[0].components[1];

    const decodedResponse = web3.eth.abi.decodeParameter(responseType, proof.response_hex);

    while (true) {
        try {
            const transaction = await agency.resolvePolicy(id, {
                merkleProof: proof.proof,
                data: decodedResponse,
            });
            console.log("Transaction:", transaction.tx, "\n");
            break;
        } catch (error) {
            console.log("Error:", error, "\n");
            await sleep(20000);
        }
    }
}

async function main() {
    const agency: WeatherIdAgencyInstance = await WeatherIdAgency.at(agencyAddress);
    console.log("WeatherIdAgency:", agency.address, "\n");

    const policy = await getPolicy(agency, policyId);

    const apiUrl = prepareUrl(policy);

    const data = await prepareAttestationRequest(apiUrl, postprocessJq, abiSignature);

    const abiEncodedRequest = data.abiEncodedRequest;

    const roundId = await submitAttestationRequest(abiEncodedRequest);

    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);

    await resolvePolicy(agency, policyId, proof);
}

void main().then(() => {
    process.exit(0);
});
