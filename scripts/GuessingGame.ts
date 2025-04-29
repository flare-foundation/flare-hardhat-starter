import { run } from "hardhat";
import { GuessingGameInstance } from "../typechain-types";

const GuessingGame = artifacts.require("GuessingGame");

// yarn hardhat run scripts/GuessingGame.ts --network coston2

const MAX_NUMBER = 100;

async function deployAndVerify() {
    const args: any[] = [MAX_NUMBER];
    const guessingGame: GuessingGameInstance = await GuessingGame.new(...args);
    try {
        await run("verify:verify", {
            address: guessingGame.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log("GuessingGame deployed to", guessingGame.address);
}

void deployAndVerify().then(() => {
    process.exit(0);
});
