// ===============================================================================================================================
//
//
// DEPRECATED: use Web2Json instead
//
//
// ===============================================================================================================================

import { run, web3 } from "hardhat";
import { StarWarsCharacterListInstance } from "../../typechain-types";
import { prepareAttestationRequestBase, submitAttestationRequest, retrieveDataAndProofBaseWithRetry } from "./Base";

const StarWarsCharacterList = artifacts.require("StarWarsCharacterList");

const { JQ_VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

// yarn hardhat run scripts/fdcExample/JsonApi.ts --network coston2

// Request data
const apiUrl = "https://swapi.dev/api/people/3/";
const postprocessJq = `{name: .name, height: .height, mass: .mass, numberOfFilms: .films | length, uid: (.url | split("/") | .[-2] | tonumber)}`;
const abiSignature = `{"components": [{"internalType": "string", "name": "name", "type": "string"},{"internalType": "uint256", "name": "height", "type": "uint256"},{"internalType": "uint256", "name": "mass", "type": "uint256"},{"internalType": "uint256", "name": "numberOfFilms", "type": "uint256"},{"internalType": "uint256", "name": "uid", "type": "uint256"}],"name": "task","type": "tuple"}`;

// Configuration constants
const attestationTypeBase = "IJsonApi";
const sourceIdBase = "WEB2";
const verifierUrlBase = JQ_VERIFIER_URL_TESTNET;

async function prepareAttestationRequest(apiUrl: string, postprocessJq: string, abiSignature: string) {
    const requestBody = {
        url: apiUrl,
        postprocessJq: postprocessJq,
        abi_signature: abiSignature,
    };

    const url = `${verifierUrlBase}JsonApi/prepareRequest`;
    const apiKey = VERIFIER_API_KEY_TESTNET;

    return await prepareAttestationRequestBase(url, apiKey, attestationTypeBase, sourceIdBase, requestBody);
}

async function retrieveDataAndProof(abiEncodedRequest: string, roundId: number) {
    const url = `${COSTON2_DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
    console.log("Url:", url, "n");
    return await retrieveDataAndProofBaseWithRetry(url, abiEncodedRequest, roundId);
}

async function deployAndVerifyContract() {
    const args: any[] = [];
    const characterList: StarWarsCharacterListInstance = await StarWarsCharacterList.new(...args);
    try {
        await run("verify:verify", {
            address: characterList.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log("StarWarsCharacterList deployed to", characterList.address, "\n");
    return characterList;
}

async function interactWithContract(characterList: StarWarsCharacterListInstance, proof: any) {
    console.log("Proof hex:", proof.response_hex, "\n");

    // A piece of black magic that allows us to read the response type from an artifact
    const IJsonApiVerification = await artifacts.require("IJsonApiVerification");
    const responseType = IJsonApiVerification._json.abi[0].inputs[0].components[1];
    console.log("Response type:", responseType, "\n");

    const decodedResponse = web3.eth.abi.decodeParameter(responseType, proof.response_hex);
    console.log("Decoded proof:", decodedResponse, "\n");
    const transaction = await characterList.addCharacter({
        merkleProof: proof.proof,
        data: decodedResponse,
    });
    console.log("Transaction:", transaction.tx, "\n");
    console.log("Star Wars Characters:\n", await characterList.getAllCharacters(), "\n");
}

async function main() {
    const data = await prepareAttestationRequest(apiUrl, postprocessJq, abiSignature);
    console.log("Data:", data, "\n");

    const abiEncodedRequest = data.abiEncodedRequest;
    const roundId = await submitAttestationRequest(abiEncodedRequest);

    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);

    const characterList: StarWarsCharacterListInstance = await deployAndVerifyContract();

    await interactWithContract(characterList, proof);
}

void main().then(() => {
    process.exit(0);
});
