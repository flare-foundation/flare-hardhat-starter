import flareLib = require("@flarenetwork/flare-periphery-contract-artifacts");
import "dotenv/config";

import { TransactionResponse } from "ethers";
import hardhat, { ethers } from "hardhat";
import { requestVerification, sleep } from "../lib/utils";
import { EthereumPaymentCollectorContract, FallbackContractContract, FallbackContractInstance } from "../typechain-types";

const randomEthereumAddress = "0xFf02F742106B8a25C26e65C1f0d66BEC3C90d429";

const { EVM_VERIFIER_URL, ATTESTATION_API_KEY, ATTESTATION_URL } = process.env;


const FallbackContract: FallbackContractContract = artifacts.require("FallbackContract");
const EthereumPaymentCollector: EthereumPaymentCollectorContract = artifacts.require("EthereumPaymentCollector");
// The same function can also be found in State Connector utils bundled with the artifact periphery package (`encodeAttestationName`)

// Simple hex encoding
function toHex(data: string): string {
    var result = "";
    for (var i = 0; i < data.length; i++) {
        result += data.charCodeAt(i).toString(16);
    }
    return "0x" + result.padEnd(64, "0");
}


interface AttestationResponse {
    abiEncodedRequest: string;
    status: string;
}

interface EVMRequestBody {
    transactionHash: string,
    requiredConfirmations: string,
    provideInput: boolean,
    listEvents: boolean,
    logIndices: number[]
}

async function prepareAttestationRequest(attestationType: string, network: string, sourceId: string, requestBody: EVMRequestBody): Promise<any> {
    const response = await fetch(
        `${EVM_VERIFIER_URL}/verifier/${network}/${attestationType}/prepareRequest`,
        {
            method: "POST",
            headers: { "X-API-KEY": ATTESTATION_API_KEY as string, "Content-Type": "application/json" },
            body: JSON.stringify({
                "attestationType": toHex(attestationType),
                "sourceId": toHex(sourceId),
                "requestBody": requestBody
            })
        }
    );
    const data = await response.json();
    return data;
}

async function prepareAttestationResponse(attestationType: string, network: string, sourceId: string, requestBody: EVMRequestBody): Promise<AttestationResponse> {
    const response = await fetch(
        `${EVM_VERIFIER_URL}/verifier/${network}/${attestationType}/prepareResponse`,
        {
            method: "POST",
            headers: { "X-API-KEY": ATTESTATION_API_KEY as string, "Content-Type": "application/json" },
            body: JSON.stringify({
                "attestationType": toHex(attestationType),
                "sourceId": toHex(sourceId),
                "requestBody": requestBody
            })
        }
    );
    const data = await response.json();
    return data;
}

async function requestMerkleProof(scRound: number, txID: string) {

    const attestationRequest = await prepareAttestationRequest(
        "EVMTransaction",
        "eth",
        "testETH",
        {
            transactionHash: txID,
            requiredConfirmations: "1",
            provideInput: true,
            listEvents: true,
            logIndices: []
        }
    );

    const attestationProof = {
        "roundId": Number(scRound),
        "requestBytes": attestationRequest.abiEncodedRequest
    };
    const response = await fetch(
        `${ATTESTATION_URL}/attestation-client/api/proof/get-specific-proof`,
        {
            method: "POST",
            headers: { "X-API-KEY": ATTESTATION_API_KEY as string, "Content-Type": "application/json" },
            body: JSON.stringify(attestationProof)
        }
    );

    // Verified attestation proof from verifiers API endpoint.
    const responseData = await response.json();
    return responseData;
}

async function createSimpleTransaction(targetAddress: string, value: number | string, data: string): Promise<TransactionResponse> {
    const [from] = await ethers.getSigners();
    const tx = await from.sendTransaction({ to: targetAddress, value: value, data: data });
    return tx;
}

async function deployFallbackContract(): Promise<FallbackContractInstance> {
    const contract = await FallbackContract.new();
    await requestVerification(contract.address, [])
    return contract;
}

async function createSepoliaTransactions() {
    const fallback = await deployFallbackContract();
    // Wait for txs to be included in a block
    const tx1 = await createSimpleTransaction(randomEthereumAddress, 10, "0x0123456789");
    await tx1.wait();
    const tx2 = await createSimpleTransaction(fallback.address, 10, "0x9876543210");
    await tx2.wait();

    console.log(tx1.hash);
    // Wait for the validator to pick it up
    await sleep(10000);

    console.log(
        JSON.stringify(await prepareAttestationResponse("EVMTransaction", "eth", "testETH", {
            transactionHash: tx1.hash,
            requiredConfirmations: "1",
            provideInput: true,
            listEvents: true,
            logIndices: []
        }), null, 2)
    )

    console.log(tx2.hash);
    console.log(
        JSON.stringify(await prepareAttestationResponse("EVMTransaction", "eth", "testETH", {
            transactionHash: tx2.hash,
            requiredConfirmations: "1",
            provideInput: true,
            listEvents: true,
            logIndices: []
        }), null, 2)
    )
}

async function executeStateConnectorProof(txs: string[]) {

    const stateConnector = await ethers.getContractAt(
        flareLib.nameToAbi("IStateConnector", "coston").data,
        flareLib.nameToAddress("StateConnector", "coston"),
    );

    const responses = await Promise.all(txs.map(async (tx) => {
        const req = await prepareAttestationRequest("EVMTransaction", "eth", "testETH", {
            transactionHash: tx,
            requiredConfirmations: "1",
            provideInput: true,
            listEvents: true,
            logIndices: []
        });
        return req["abiEncodedRequest"];
    }))

    // Call to the StateConnector protocol to provide attestation.

    const sc_txs = []
    for (const response of responses) {
        const tx = await stateConnector.requestAttestations(
            response
        );
        sc_txs.push(tx);
    }
    await Promise.all(sc_txs.map(async (tx) => { tx.wait() }));

    // Get constants from State connector smart contract
    const BUFFER_TIMESTAMP_OFFSET = Number(await stateConnector.BUFFER_TIMESTAMP_OFFSET());
    const BUFFER_WINDOW = Number(await stateConnector.BUFFER_WINDOW());


    await Promise.all(sc_txs.map(async (tx) => {
        return await tx.wait();
    }))

    const rounds = await Promise.all(sc_txs.map(async (tx) => {
        // Get block number of the block containing contract call
        const blockNumber = tx.blockNumber;
        const block = await ethers.provider.getBlock(blockNumber);
        // Calculate roundId
        const roundId = Math.floor((block!.timestamp - BUFFER_TIMESTAMP_OFFSET) / BUFFER_WINDOW);
        // console.log("scRound:", roundId);
        return roundId;
    }))
    console.log("Rounds: ", rounds.map(r => r.toString()));

    // Wait until the round is confirmed
    while (Number(await stateConnector.lastFinalizedRoundId()) < rounds[rounds.length - 1]) {
        console.log("Waiting for the round to be confirmed", await stateConnector.lastFinalizedRoundId(), rounds[rounds.length - 1]);
        await sleep(20000);
    }

    console.log("Round confirmed, getting proof")
    // Get the proof
    const proofs = await Promise.all(txs.map(async (tx) => {
        return await requestMerkleProof(rounds[0], tx);
    }))


    const onChainCollector = await EthereumPaymentCollector.new();
    await requestVerification(onChainCollector.address, [])
    for (const proof of proofs) {
        const txData = {
            data: proof.data.response,
            merkleProof: proof.data.merkleProof,
        }
        console.log(JSON.stringify(txData, null, 2))
        await onChainCollector.collectPayment(txData);
    }
}

async function main() {

    if (hardhat.network.name == "sepolia") {
        await createSepoliaTransactions();
    } else if (hardhat.network.name == "coston") {
        await executeStateConnectorProof(
            [
                "0xac640ab047aa1097ddd473e5940921eb500a9912b33072b8532617692428830e",
                "0x7eb54cde238fc700be31c98af7e4df8c4fc96fd5c634c490183ca612a481efcc"
            ]);
    }

}

main().then(() => process.exit(0))