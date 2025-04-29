import { run } from "hardhat";
import { HelloWorldInstance } from "../typechain-types";

const HelloWorld = artifacts.require("HelloWorld");

// yarn hardhat run scripts/HelloWorld.ts --network coston2

const WORLD = "Alderaan";

async function deployAndVerify() {
    const args: any[] = [WORLD];
    const helloWorld: HelloWorldInstance = await HelloWorld.new(...args);
    try {
        await run("verify:verify", {
            address: helloWorld.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log("HelloWorld deployed to", helloWorld.address);
}

void deployAndVerify().then(() => {
    process.exit(0);
});
