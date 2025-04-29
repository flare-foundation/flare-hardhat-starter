import hre, { run } from "hardhat";
import { TokenStateReaderInstance } from "../../typechain-types";

const TokenStateReader = artifacts.require("TokenStateReader");

// yarn hardhat run scripts/proofOfReserves/deployTokenStateReader.ts --network coston && yarn hardhat run scripts/proofOfReserves/deployTokenStateReader.ts --network coston2

async function deployAndVerify() {
    const args: any[] = [];
    const tokenStateReader: TokenStateReaderInstance = await TokenStateReader.new(...args);
    try {
        await run("verify:verify", {
            address: tokenStateReader.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log(`(${hre.network.name}) TokenStateReader deployed to`, tokenStateReader.address, "\n");
}

void deployAndVerify().then(() => {
    process.exit(0);
});
