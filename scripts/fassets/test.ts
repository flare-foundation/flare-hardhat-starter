import { web3 } from "hardhat";
import { getFXRPAssetManager } from "../utils/fassets";

const IAssetManager = artifacts.require("IAssetManager");

// yarn hardhat run scripts/fassets/test.ts --network coston2

const rawLogs = [
    {
        address: "0x8b4abA9C4BD7DD961659b02129beE20c6286e17F",
        topics: [
            "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
            "0x0000000000000000000000000d09ff7630588e05e2449abd3ddd1d8d146bc5c2",
            "0x000000000000000000000000406b53756d98166458fb754998812f354639f56b",
        ],
        data: "0x0000000000000000000000000000000000000000000000000000000000000000",
        blockNumber: 19795972,
        transactionHash: "0xe85d56db87121e1d3bcf11dcdf64c34dab6b319836faa2fdafaf8798bdeb1877",
        transactionIndex: 1,
        blockHash: "0xa253ec45967d1d1776c20656820e9f53b1fc240a2f2cd5119d80cd0a47b36374",
        logIndex: 7,
        removed: false,
        id: "log_af5dcca9",
    },
    {
        address: "0x8b4abA9C4BD7DD961659b02129beE20c6286e17F",
        topics: [
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
            "0x0000000000000000000000000d09ff7630588e05e2449abd3ddd1d8d146bc5c2",
            "0x000000000000000000000000406b53756d98166458fb754998812f354639f56b",
        ],
        data: "0x0000000000000000000000000000000000000000000000000000000000989680",
        blockNumber: 19795972,
        transactionHash: "0xe85d56db87121e1d3bcf11dcdf64c34dab6b319836faa2fdafaf8798bdeb1877",
        transactionIndex: 1,
        blockHash: "0xa253ec45967d1d1776c20656820e9f53b1fc240a2f2cd5119d80cd0a47b36374",
        logIndex: 8,
        removed: false,
        id: "log_1c5b7acb",
    },
    {
        address: "0xDeD50DA9C3492Bee44560a4B35cFe0e778F41eC5",
        topics: [
            "0xb7f65e70a51658e24800516a5dc90e2dd65176e18381adda77f58e2044482b19",
            "0x000000000000000000000000506beebc147fae8d62c7770442d739247fe210f2",
            "0x00000000000000000000000000000000000000000000000000000000000004be",
        ],
        data: "0x",
        blockNumber: 19795972,
        transactionHash: "0xe85d56db87121e1d3bcf11dcdf64c34dab6b319836faa2fdafaf8798bdeb1877",
        transactionIndex: 1,
        blockHash: "0xa253ec45967d1d1776c20656820e9f53b1fc240a2f2cd5119d80cd0a47b36374",
        logIndex: 9,
        removed: false,
        id: "log_e4544e15",
    },
    {
        address: "0xDeD50DA9C3492Bee44560a4B35cFe0e778F41eC5",
        topics: [
            "0x8cbbd73a8d1b8b02a53c4c3b0ee34b472fe3099cc19bcfb57f1aae09e8a9847e",
            "0x000000000000000000000000506beebc147fae8d62c7770442d739247fe210f2",
            "0x000000000000000000000000406b53756d98166458fb754998812f354639f56b",
            "0x00000000000000000000000000000000000000000000000000000000005e310c",
        ],
        data: "0x00000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000989680000000000000000000000000000000000000000000000000000000000000c350000000000000000000000000000000000000000000000000000000000087c1d7000000000000000000000000000000000000000000000000000000000087c40e0000000000000000000000000000000000000000000000000000000068750f3e46425052664100020000000000000000000000000000000000000000005e310c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002172534859756945767359734b5238755548684254754750357a6a52634774346e6d00000000000000000000000000000000000000000000000000000000000000",
        blockNumber: 19795972,
        transactionHash: "0xe85d56db87121e1d3bcf11dcdf64c34dab6b319836faa2fdafaf8798bdeb1877",
        transactionIndex: 1,
        blockHash: "0xa253ec45967d1d1776c20656820e9f53b1fc240a2f2cd5119d80cd0a47b36374",
        logIndex: 10,
        removed: false,
        id: "log_10d27d11",
    },
    {
        address: "0x8b4abA9C4BD7DD961659b02129beE20c6286e17F",
        topics: [
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
            "0x000000000000000000000000406b53756d98166458fb754998812f354639f56b",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
        ],
        data: "0x0000000000000000000000000000000000000000000000000000000000989680",
        blockNumber: 19795972,
        transactionHash: "0xe85d56db87121e1d3bcf11dcdf64c34dab6b319836faa2fdafaf8798bdeb1877",
        transactionIndex: 1,
        blockHash: "0xa253ec45967d1d1776c20656820e9f53b1fc240a2f2cd5119d80cd0a47b36374",
        logIndex: 11,
        removed: false,
        id: "log_0f391608",
    },
];

// Higher-order function to parse events by name from raw logs
const parseEventByName = (rawLogs: any[], eventName: string, contractAbi: any) => {
    const eventAbi = contractAbi.find(e => e.name === eventName);
    if (!eventAbi) {
        console.log(`Event ${eventName} not found in ABI`);
        return [];
    }

    const eventSignatureHash = web3.eth.abi.encodeEventSignature(eventAbi);
    console.log(`Looking for event: ${eventName} with signature: ${eventSignatureHash}`);

    // Higher-order function approach using filter and map
    return rawLogs
        .filter(log => log.topics[0] === eventSignatureHash)
        .map(log => {
            try {
                console.log(`\nFound ${eventName} event!`);
                console.log("Log address:", log.address);

                // Decode the log data using the event ABI
                const decoded = web3.eth.abi.decodeLog(
                    eventAbi.inputs,
                    log.data,
                    log.topics.slice(1) // skip the signature hash
                );

                console.log(`\nDecoded ${eventName} event arguments:`);
                console.log(JSON.stringify(decoded, null, 2));

                return {
                    log,
                    decoded,
                    eventName,
                };
            } catch (e) {
                console.log(`Error parsing ${eventName} event:`, e);
                return null;
            }
        })
        .filter(Boolean); // Remove any null results from failed parsing
};

async function main() {
    console.log("=== Testing Event Parsing Function ===");

    // Parse RedemptionRequested events
    const redemptionEvents = parseEventByName(rawLogs, "RedemptionRequested", IAssetManager.abi);
    console.log(`\nFound ${redemptionEvents.length} RedemptionRequested events`);

    console.log("redemptionEvents");
    console.log(redemptionEvents[0].decoded);

    // Parse RedemptionTicketUpdated events (if any)
    // const redemptionTicketUpdatedEvents = parseEventByName(rawLogs, "RedemptionTicketUpdated", IAssetManager.abi);
    // console.log(`\nFound ${redemptionTicketUpdatedEvents.length} RedemptionTicketUpdated events`);

    // Parse Transfer events (ERC20 standard)
    // const transferEvents = parseEventByName(rawLogs, "Transfer", IAssetManager.abi);
    // console.log(`\nFound ${transferEvents.length} Transfer events`);

    // // Example: Extract specific data from the first RedemptionRequested event
    // if (redemptionEvents.length > 0) {
    //   const firstEvent = redemptionEvents[0];
    //   console.log("\n=== First RedemptionRequested Event Details ===");

    //   if (firstEvent.decoded.redeemer) {
    //     console.log("Redeemer:", firstEvent.decoded.redeemer);
    //   }
    //   if (firstEvent.decoded.agentVault) {
    //     console.log("Agent Vault:", firstEvent.decoded.agentVault);
    //   }
    //   if (firstEvent.decoded.lotsUBA) {
    //     console.log("Lots UBA:", firstEvent.decoded.lotsUBA);
    //   }
    //   if (firstEvent.decoded.feeUBA) {
    //     console.log("Fee UBA:", firstEvent.decoded.feeUBA);
    //   }
    //   if (firstEvent.decoded.underlyingAddressString) {
    //     console.log("Underlying Address String:", firstEvent.decoded.underlyingAddressString);
    //   }
    // }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
