import { artifacts, ethers, run } from "hardhat";
import { TransferEventListenerInstance } from "../typechain-types";

const TransferEventListener = artifacts.require("TransferEventListener");
const FDCHub = artifacts.require("@flarenetwork/flare-periphery-contracts/coston/IFdcHub.sol:IFdcHub");

// Simple hex encoding
function toHex(data) {
    var result = "";
    for (var i = 0; i < data.length; i++) {
        result += data.charCodeAt(i).toString(16);
    }
    return result.padEnd(64, "0");
}

const { VERIFIER_URL_TESTNET, VERIFIER_PUBLIC_API_KEY_TESTNET, DA_LAYER_URL_COSTON2 } = process.env;

const TX_ID =
    "0x4e636c6590b22d8dcdade7ee3b5ae5572f42edb1878f09b3034b2f7c3362ef3c";

// const TRANSFER_EVENT_LISTENER_ADDRESS = "0xD7e76b28152aADC59D8C857a1645Ea1552F7f7fB"; // coston
const TRANSFER_EVENT_LISTENER_ADDRESS = "0x109115725060f1eCa849cea67A9699446491b381"; // coston2

async function deployMainPaymentCollector() {
    const transferEventListener: TransferEventListenerInstance =
        await TransferEventListener.new();

    console.log("TransferEventListener deployed at:", transferEventListener.address);
    // verify 
    const result = await run("verify:verify", {
        address: transferEventListener.address,
        constructorArguments: [],
    })
}

// deployMainPaymentCollector().then((data) => {
//     process.exit(0);
// });


async function prepareRequest() {
    const attestationType = "0x" + toHex("EVMTransaction");
    const sourceType = "0x" + toHex("testETH");
    const requestData = {
        attestationType: attestationType,
        sourceId: sourceType,
        requestBody: {
            transactionHash: TX_ID,
            requiredConfirmations: "1",
            provideInput: true,
            listEvents: true,
            logIndices: [],
        },
    };
    const response = await fetch(
        `${VERIFIER_URL_TESTNET}verifier/eth/EVMTransaction/prepareRequest`,
        {
            method: "POST",
            headers: {
                "X-API-KEY": VERIFIER_PUBLIC_API_KEY_TESTNET,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
        },
    );
    const data = await response.json();
    console.log("Prepared request:", data);
    return data;
}


// prepareRequest().then((data) => {
//     console.log("Prepared request:", data);
//     process.exit(0);
// });

const firstVotingRoundStartTs = 1658429955;
const votingEpochDurationSeconds = 90;

async function submitRequest() {
    const requestData = await prepareRequest();

    const transferEventListener: TransferEventListenerInstance = await TransferEventListener.at(TRANSFER_EVENT_LISTENER_ADDRESS);


    const fdcHUB = await FDCHub.at(await transferEventListener.getFdcHub());

    // Call to the FDC Hub protocol to provide attestation.
    const tx = await fdcHUB.requestAttestation(requestData.abiEncodedRequest, {
        value: ethers.parseEther("1").toString(),
    });
    console.log("Submitted request:", tx.tx);

    // Get block number of the block containing contract call
    const blockNumber = tx.blockNumber;
    const block = await ethers.provider.getBlock(blockNumber);

    // Calculate roundId
    const roundId = Math.floor(
        (block!.timestamp - firstVotingRoundStartTs) / votingEpochDurationSeconds,
    );
    console.log(
        `Check round progress at: https://coston-systems-explorer.flare.rocks/voting-epoch/${roundId}?tab=fdc`,
    );
    return roundId;
}

// submitRequest().then((data) => {
//     console.log("Submitted request:", data);
//     process.exit(0);
// });


const TARGET_ROUND_ID = 892542; // 0

async function getProof(roundId: number) {
    const request = await prepareRequest();
    const proofAndData = await fetch(
        `${DA_LAYER_URL_COSTON2}fdc/get-proof-round-id-bytes`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // "X-API-KEY": API_KEY,
            },
            body: JSON.stringify({
                votingRoundId: roundId,
                requestBytes: request.abiEncodedRequest,
            }),
        },
    );

    return await proofAndData.json();
}

// getProof(TARGET_ROUND_ID)
//     .then((data) => {
//         console.log("Proof and data:");
//         console.log(JSON.stringify(data, undefined, 2));
//     })
//     .catch((e) => {
//         console.error(e);
//     });


async function submitProof() {
    const dataAndProof = await getProof(TARGET_ROUND_ID);
    const transferEventListener = await TransferEventListener.at(TRANSFER_EVENT_LISTENER_ADDRESS);

    const tx = await transferEventListener.collectTransferEvents({
        merkleProof: dataAndProof.proof,
        data: dataAndProof.response,
    });
    console.log(tx.hash);
    console.log(await transferEventListener.getTokenTransfers());
}


// submitProof()
//     .then((data) => {
//         console.log("Submitted proof");
//         process.exit(0);
//     })
//     .catch((e) => {
//         console.error(e);
//     });
