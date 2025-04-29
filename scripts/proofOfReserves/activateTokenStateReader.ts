import hre from "hardhat";
import { TokenStateReaderInstance } from "../../typechain-types";

import { tokenAddresses, readerAddresses } from "./config";

const TokenStateReader = artifacts.require("TokenStateReader");

// yarn hardhat run scripts/proofOfReserves/activateTokenStateReader.ts --network coston && yarn hardhat run scripts/proofOfReserves/activateTokenStateReader.ts --network coston2

async function main() {
    const network = hre.network.name;
    const tokenAddress = tokenAddresses.get(network);
    const readerAddress = readerAddresses.get(network);
    const reader: TokenStateReaderInstance = await TokenStateReader.at(readerAddress);

    const transaction = await reader.broadcastTokenSupply(tokenAddress);
    console.log(`(${network}) Transaction id:`, transaction.tx, "\n");
}

void main().then(() => {
    process.exit(0);
});
