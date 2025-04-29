import { run } from "hardhat";
import { MyNFTInstance } from "../../typechain-types";

const MyNFT = artifacts.require("MyNFT");

// yarn hardhat run scripts/crossChainPayment/deployNFT.ts --network coston2

const OWNER = "0xF5488132432118596fa13800B68df4C0fF25131d";

async function deployAndVerify() {
    const args: any[] = [OWNER, OWNER];
    const myStablecoin: MyNFTInstance = await MyNFT.new(...args);
    try {
        await run("verify:verify", {
            address: myStablecoin.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log(`MyNFT deployed to`, myStablecoin.address, "\n");
}

void deployAndVerify().then(() => {
    process.exit(0);
});
