import hre, { ethers } from "hardhat";
import { toUtf8HexString, sleep } from "./core";
import { getContractAddressByName, getFlareSystemsManager, getFdcHub, getRelay, getFdcVerification } from "./getters";
import {
    IFlareSystemsManagerInstance,
    IFdcRequestFeeConfigurationsInstance,
    IRelayInstance,
    IFdcVerificationInstance,
} from "../../typechain-types";

const FdcRequestFeeConfigurations = artifacts.require("IFdcRequestFeeConfigurations");

export async function getFdcRequestFee(abiEncodedRequest: string) {
    const fdcRequestFeeConfigurationsAddress: string = await getContractAddressByName("FdcRequestFeeConfigurations");
    const fdcRequestFeeConfigurations: IFdcRequestFeeConfigurationsInstance = await FdcRequestFeeConfigurations.at(
        fdcRequestFeeConfigurationsAddress
    );
    return await fdcRequestFeeConfigurations.getRequestFee(abiEncodedRequest);
}

export async function prepareAttestationRequestBase(
    url: string,
    apiKey: string,
    attestationTypeBase: string,
    sourceIdBase: string,
    requestBody: any
) {
    console.log("Url:", url, "\n");
    const attestationType = toUtf8HexString(attestationTypeBase);
    const sourceId = toUtf8HexString(sourceIdBase);

    const request = {
        attestationType: attestationType,
        sourceId: sourceId,
        requestBody: requestBody,
    };
    console.log("Prepared request:\n", request, "\n");

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
    });
    if (response.status !== 200) {
        throw new Error(`Response status is not OK, status ${response.status} ${response.statusText}\n`);
    }
    console.log("Response status is OK\n");

    return await response.json();
}

export async function calculateRoundId(transaction: any) {
    const blockNumber = transaction.receipt.blockNumber;
    const block = await ethers.provider.getBlock(blockNumber);
    const blockTimestamp = BigInt(block.timestamp);

    const flareSystemsManager: IFlareSystemsManagerInstance = await getFlareSystemsManager();
    const firsVotingRoundStartTs = BigInt(await flareSystemsManager.firstVotingRoundStartTs());
    const votingEpochDurationSeconds = BigInt(await flareSystemsManager.votingEpochDurationSeconds());

    console.log("Block timestamp:", blockTimestamp, "\n");
    console.log("First voting round start ts:", firsVotingRoundStartTs, "\n");
    console.log("Voting epoch duration seconds:", votingEpochDurationSeconds, "\n");

    const roundId = Number((blockTimestamp - firsVotingRoundStartTs) / votingEpochDurationSeconds);
    console.log("Calculated round id:", roundId, "\n");
    console.log("Received round id:", Number(await flareSystemsManager.getCurrentVotingEpochId()), "\n");
    return roundId;
}

export async function submitAttestationRequest(abiEncodedRequest: string) {
    const fdcHub = await getFdcHub();

    const requestFee = await getFdcRequestFee(abiEncodedRequest);

    const transaction = await fdcHub.requestAttestation(abiEncodedRequest, {
        value: requestFee,
    });
    console.log("Submitted request:", transaction.tx, "\n");

    const roundId = await calculateRoundId(transaction);
    console.log(
        `Check round progress at: https://${hre.network.name}-systems-explorer.flare.rocks/voting-round/${roundId}?tab=fdc\n`
    );
    return roundId;
}

export async function postRequestToDALayer(url: string, request: any, watchStatus: boolean = false) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            //   "X-API-KEY": "",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
    });
    if (watchStatus && response.status !== 200) {
        throw new Error(`Response status is not OK, status ${response.status} ${response.statusText}\n`);
    } else if (watchStatus) {
        console.log("Response status is OK\n");
    }
    return await response.json();
}

export async function retrieveDataAndProofBase(url: string, abiEncodedRequest: string, roundId: number) {
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
    while (proof.response_hex === undefined) {
        await sleep(10000);
        proof = await postRequestToDALayer(url, request, false);
    }
    console.log("Proof generated!\n");

    console.log("Proof:", proof, "\n");
    return proof;
}

export async function retrieveDataAndProofBaseWithRetry(
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
