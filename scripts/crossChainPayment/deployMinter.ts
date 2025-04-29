import { run } from "hardhat";
import { NFTMinterInstance, MyNFTInstance } from "../../typechain-types";
import { nftAddress } from "./config";

const NFTMinter = artifacts.require("NFTMinter");
const MyNFT = artifacts.require("MyNFT");

// yarn hardhat run scripts/crossChainPayment/deployMinter.ts --network coston2

async function deployAndVerify() {
    const myNFT: MyNFTInstance = await MyNFT.at(nftAddress);

    const args: any[] = [myNFT.address];
    const nftMinter: NFTMinterInstance = await NFTMinter.new(...args);
    try {
        await run("verify:verify", {
            address: nftMinter.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log(`NFTMinter deployed to`, nftMinter.address, "\n");

    const minterRole = await myNFT.MINTER_ROLE();
    console.log("MINTER_ROLE:", minterRole, "\n");

    await myNFT.grantRole(minterRole, nftMinter.address);
    console.log("NFTMinter has MINTER_ROLE:", await myNFT.hasRole(minterRole, nftMinter.address), "\n");
}

void deployAndVerify().then(() => {
    process.exit(0);
});
