import "@nomicfoundation/hardhat-verify";
import axios from "axios";
import "dotenv/config";
import { artifacts, ethers, run } from 'hardhat';
import { FTSOV2NFTContract, FTSOV2NFTInstance } from '../typechain-types';
const FTSOV2NFT: FTSOV2NFTContract = artifacts.require('FTSOV2NFT');

const { API_URL, API_KEY } = process.env

// Simple hex encoding
function toHexFeedId(data: string): string {
    var result = "01";
    for (var i = 0; i < data.length; i++) {
        result += data.charCodeAt(i).toString(16);
    }
    return "0x" + result.padEnd(42, "0");
}


async function getPrice(symbol: string, epoch: number) {
    const full_url = `${API_URL}specific-feed/${symbol}/${epoch}`
    const data = await axios.get(
        full_url,
        {
            headers: {
                "X-API-KEY": API_KEY
            }
        }
    )

    const dataWithProof = data.data.feedWithProof;
    return dataWithProof
}

async function getDummyPrice(symbol: string, epoch: number, price: number, decimals: number) {
    return {
        proof: [],
        body: {
            votingRoundId: epoch,
            id: symbol,
            value: price,
            turnoutBIPS: 65535, // 100%
            decimals: decimals
        }
    }
}

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    const args: any[] = ["My token", "TOK"]

    const simpleNFTExample: FTSOV2NFTInstance = await FTSOV2NFT.new(...args)

    // Both ways are the same
    // const BTC = await simpleNFTExample.encode("BTC/USD")
    const BTC = toHexFeedId("BTC/USD")
    const FLR = toHexFeedId("FLR/USD")
    const ETH = toHexFeedId("ETH/USD")

    const currentVotingEpoch = (await simpleNFTExample.getSafeVotingRoundId()).toNumber()

    // const btcPrice = await getPrice(BTC, currentVotingEpoch)
    // const flrPrice = await getPrice(FLR, currentVotingEpoch)
    const flrPrice = await getDummyPrice(FLR, currentVotingEpoch,
        30000, 4
    )
    // const ethPrice = await getPrice(ETH, currentVotingEpoch)
    const ethPrice = await getDummyPrice(ETH, currentVotingEpoch,
        600000, 2

    )

    const price = await simpleNFTExample.getPriceInFlare(
        "ETH/USD",
        ethPrice,
        flrPrice,
    )

    const tx = await simpleNFTExample.buyNFT(
        "ETH/USD",
        ethPrice,
        flrPrice,
        {
            value: price
        }
    )
    console.log(tx)
    try {
        const result = await run("verify:verify", {
            address: simpleNFTExample.address,
            constructorArguments: args,
        })

        console.log(result)
    } catch (e: any) {
        console.log(e.message)
    }
}

main().then(() => process.exit(0))