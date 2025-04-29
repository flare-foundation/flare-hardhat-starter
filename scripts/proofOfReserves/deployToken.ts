import hre, { run } from "hardhat";
import { MyStablecoinInstance } from "../../typechain-types";

const MyStablecoin = artifacts.require("MyStablecoin");

// yarn hardhat run scripts/proofOfReserves/deployToken.ts --network coston && yarn hardhat run scripts/proofOfReserves/deployToken.ts --network coston2

const OWNER = "0xF5488132432118596fa13800B68df4C0fF25131d";

async function deployAndVerify() {
    const args: any[] = [OWNER, OWNER];
    const myStablecoin: MyStablecoinInstance = await MyStablecoin.new(...args);
    try {
        await run("verify:verify", {
            address: myStablecoin.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log(`(${hre.network.name}) MyStablecoin deployed to`, myStablecoin.address, "\n");
}

void deployAndVerify().then(() => {
    process.exit(0);
});
