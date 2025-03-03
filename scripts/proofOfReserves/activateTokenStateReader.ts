import hre from "hardhat";
import { MyStablecoinInstance } from "../../typechain-types";
import { TokenStateReaderInstance } from "../../typechain-types";

const MyStablecoin = artifacts.require("MyStablecoin");
const TokenStateReader = artifacts.require("TokenStateReader");

// yarn hardhat run scripts/proofOfReserves/activateTokenStateReader.ts --network coston && yarn hardhat run scripts/proofOfReserves/activateTokenStateReader.ts --network coston2

// Contract address depends on the network it was deployed at
const tokenAddresses = new Map([
  ["coston", "0x971C2CbD573e9aCbad555Fdd2252ab21eb73a962"],
  ["coston2", "0x1C57e92ca1d10403B1F425699fe629B439F68A12"],
]);
const readerAddresses = new Map([
  ["coston", "0xa55ca3B48C3343f4eeC31433c4c9EEB6F806cF72"],
  ["coston2", "0x3A8E713ca13ea199D3eB49b1bE13dcD04bB1F810"],
]);

async function main() {
  const network = hre.network.name;
  const tokenAddress = tokenAddresses.get(network);
  const readerAddress = readerAddresses.get(network);
  const token: MyStablecoinInstance = await MyStablecoin.at(tokenAddress);
  const reader: TokenStateReaderInstance = await TokenStateReader.at(
    readerAddress
  );

  const transaction = await reader.broadcastTokenSupply(tokenAddress);
  console.log(`(${network}) Transaction id:`, transaction.tx, "\n");
}

main().then((data) => {
  process.exit(0);
});
