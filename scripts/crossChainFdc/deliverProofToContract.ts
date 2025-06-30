import { run, web3 } from "hardhat";
import { StarWarsCharacterListV3Instance } from "../../typechain-types";

import { addressFdcVerification } from "./config";
import { abiEncodedRequest, roundId } from "./request";
import { IRelayInstance, IFdcVerificationInstance } from "../../typechain-types";

import { sleep, postRequestToDALayer } from "../fdcExample/Base";

const StarWarsCharacterListV3 = artifacts.require("StarWarsCharacterListV3");

const { COSTON2_DA_LAYER_URL } = process.env;

const IRelay = artifacts.require("IRelay");
const FdcVerification = artifacts.require("FdcVerification");

// yarn hardhat run scripts/crossChainFdc/deliverProofToContract.ts --network xrplEVMTestnet

const RELAY_ADDRESS = "0x72A35A930e2a35198FE8dEFf40e068B8D4b6CC78";

async function getRelay() {
    return await IRelay.at(RELAY_ADDRESS);
}

async function getFdcVerification() {
    return await FdcVerification.at(addressFdcVerification);
}

async function retrieveDataAndProofBase(url: string, abiEncodedRequest: string, roundId: number) {
    console.log("Waiting for the round to finalize...");
    // We check every 10 seconds if the round is finalized
    const relay: IRelayInstance = await getRelay();
    const fdcVerification: IFdcVerificationInstance = await getFdcVerification();
    const protocolId = await fdcVerification.fdcProtocolId();
    while (!(await relay.isFinalized(protocolId, roundId))) {
        await sleep(30000);
    }
    console.log("Round finalized!\n");

    const request = {
        votingRoundId: roundId,
        requestBytes: abiEncodedRequest,
    };
    console.log("Prepared request:\n", request, "\n");

    await sleep(10000);
    let proof = await postRequestToDALayer(url, request, true);
    console.log("Waiting for the DA Layer to generate the proof...");
    while (proof.response_hex == undefined) {
        await sleep(10000);
        proof = await postRequestToDALayer(url, request, false);
    }
    console.log("Proof generated!\n");

    console.log("Proof:", proof, "\n");
    return proof;
}

async function retrieveDataAndProofBaseWithRetry(
    url: string,
    abiEncodedRequest: string,
    roundId: number,
    attempts: number = 10
) {
    for (let i = 0; i < attempts; i++) {
        try {
            return await retrieveDataAndProofBase(url, abiEncodedRequest, roundId);
        } catch (e: any) {
            console.log(e, "\n", "Remaining attempts:", attempts - i, "\n");
            await sleep(20000);
        }
    }
    throw new Error(`Failed to retrieve data and proofs after ${attempts} attempts`);
}

async function retrieveDataAndProof(abiEncodedRequest: string, roundId: number) {
    const url = `${COSTON2_DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
    console.log("Url:", url, "n");
    return await retrieveDataAndProofBaseWithRetry(url, abiEncodedRequest, roundId);
}

async function deployAndVerifyContract() {
    const args: string[] = [addressFdcVerification];
    const characterList: StarWarsCharacterListV3Instance = await StarWarsCharacterListV3.new(...args);
    await sleep(10000);
    try {
        await run("verify:verify", {
            address: characterList.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log("StarWarsCharacterListV3 deployed to", characterList.address, "\n");
    return characterList;
}

async function interactWithContract(characterList: StarWarsCharacterListV3Instance, proof: any) {
    console.log("Proof hex:", proof.response_hex, "\n");

    // A piece of black magic that allows us to read the response type from an artifact
    const IWeb2JsonVerification = await artifacts.require("IWeb2JsonVerification");
    const responseType = IWeb2JsonVerification._json.abi[0].inputs[0].components[1];
    console.log("Response type:", responseType, "\n");

    const decodedResponse = web3.eth.abi.decodeParameter(responseType, proof.response_hex);
    console.log("Decoded proof:", decodedResponse, "\n");
    const transaction = await characterList.addCharacter(
        {
            merkleProof: proof.proof,
            data: decodedResponse,
        },
        { value: 1 }
    );
    console.log("Transaction:", transaction.tx, "\n");
    console.log("Star Wars Characters:\n", await characterList.getAllCharacters(), "\n");
}

async function main() {
    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);

    const characterList: StarWarsCharacterListV3Instance = await deployAndVerifyContract();

    await interactWithContract(characterList, proof);
}

void main().then(() => {
    process.exit(0);
});
