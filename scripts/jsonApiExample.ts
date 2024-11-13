import "@nomicfoundation/hardhat-verify";
import "dotenv/config";
import { artifacts, ethers, run } from 'hardhat';
import { JsonApiExampleContract } from '../typechain-types';
import { JsonApiExampleInstance } from "../typechain-types/contracts/web2WeatherInteractor.sol/JsonApiExample";
const JsonApiExample: JsonApiExampleContract = artifacts.require('JsonApiExample');


const { OPEN_WEATHER_API_KEY } = process.env

const VERIFIER_SERVER_URL = "http://0.0.0.0:8000/IJsonApi/prepareResponse";

async function getAttestationData(timestamp: number): Promise<any> {
    return await (await fetch(VERIFIER_SERVER_URL,
        {
            method: "POST",
            headers: { "X-API-KEY": "12345", "Content-Type": "application/json" },
            body: JSON.stringify({
                "attestationType": "0x4a736f6e41706900000000000000000000000000000000000000000000000000",
                "sourceId": "0x5745423200000000000000000000000000000000000000000000000000000000",
                "messageIntegrityCode": "0x0000000000000000000000000000000000000000000000000000000000000000",
                "requestBody": {
                    "url": `https://api.twitter.com/2/tweets/1856350782020341981?tweet.fields=author_id,created_at&expansions=author_id&user.fields=most_recent_tweet_id,pinned_tweet_id`,
                    "postprocessJq": "{data.text, .includes.users[0].username, .data.created_at, .data.public_metrics.like_count, .data.public_metrics.reply_count}",
                    "abi_signature":
                        "{\"struct Tweet\":{\"text\":\"string\",\"username\":\"string\",\"createdAt\":\"uint256\",\"likeCount\":\"uint256\",\"replyCount\":\"uint256\"}}"
                }
            })
        })).json();
}




async function main() {
    const attestationData = await getAttestationData(1729858394);

    console.log(attestationData.response);

    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);
    return
    const jsonApi: JsonApiExampleInstance = await JsonApiExample.at("0xf37e9ACe5D12a95C72Cb795A9178E6fFF34040eE") //new()

    await jsonApi.addWeather(attestationData.response);

    try {
        const result = await run("verify:verify", {
            address: jsonApi.address,
            constructorArguments: [],
        })

        console.log(result)
    } catch (e: any) {
        console.log(e.message)
    }


}

main().then(() => process.exit(0))