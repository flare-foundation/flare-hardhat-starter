import hre, { run } from "hardhat";
import fs from "fs";
import { MyNFTInstance } from "../../typechain-types";

const MyNFT = artifacts.require("MyNFT");

// yarn hardhat run scripts/crossChainPayment/deployNFT.ts --network coston2

async function deployAndVerify() {
    const owner = (await hre.ethers.getSigners())[0].address;
    console.log("NFT owner:", owner, "\n");

    const args: any[] = [owner, owner];
    const myNFT: MyNFTInstance = await MyNFT.new(...args);
    try {
        await run("verify:verify", {
            address: myNFT.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log(`MyNFT deployed to`, myNFT.address, "\n");

    fs.writeFileSync(`scripts/crossChainPayment/config/nft.ts`, `export const nftAddress = "${myNFT.address}";`);
}

void deployAndVerify().then(() => {
    process.exit(0);
});
