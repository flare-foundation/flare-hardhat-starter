import hre, { run } from "hardhat";
import { ProofOfReservesInstance } from "../../typechain-types";

const ProofOfReserves = artifacts.require("ProofOfReserves");

// We only deploy this contract on Coston2
// yarn hardhat run scripts/proofOfReserves/deployProofOfReserves.ts --network coston2

async function deployAndVerify() {
    const args: any[] = [];
    const proofOfReserves: ProofOfReservesInstance = await ProofOfReserves.new(...args);
    try {
        await run("verify:verify", {
            address: proofOfReserves.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log(`(${hre.network.name}) ProofOfReserves deployed to`, proofOfReserves.address, "\n");
}

void deployAndVerify().then(() => {
    process.exit(0);
});
