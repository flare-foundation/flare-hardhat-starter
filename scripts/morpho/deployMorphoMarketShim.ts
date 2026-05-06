import hre, { run } from "hardhat";
import fs from "fs";
import { MorphoMarketShimInstance } from "../../typechain-types";

const MorphoMarketShim = artifacts.require("MorphoMarketShim");

// yarn hardhat run scripts/morpho/deployMorphoMarketShim.ts --network coston2

// Coston2 Morpho Blue test stack — must match src/morpho/utils.ts in
// flare-smart-accounts-viem.
const MORPHO_BLUE_ADDRESS = "0x8aE0b3CE90F16E88063516f2d88C8ac2ab552d95";
const MARKET_PARAMS = {
    loanToken: "0x4984B127c3065f4348858fAFdBa020f2c8633905",
    collateralToken: "0x98bf2F2fF322d5eb61D6aE04Df50856525a85D16",
    oracle: "0x1e80830e9903c839Db803442c976DD2360D47FE0",
    irm: "0xDC275701300865D882D44ffe7cb1153535636d1a",
    lltv: "860000000000000000",
};

async function deployAndVerify() {
    const args: any[] = [MORPHO_BLUE_ADDRESS, MARKET_PARAMS];
    const shim: MorphoMarketShimInstance = await MorphoMarketShim.new(...args);
    console.log(`(${hre.network.name}) MorphoMarketShim deployed to`, shim.address, "\n");

    try {
        await run("verify:verify", {
            address: shim.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }

    const deployFileContent = `export const morphoMarketShimAddress = "${shim.address}";\n`;
    fs.writeFileSync(`scripts/morpho/deploys.ts`, deployFileContent);
}

void deployAndVerify().then(() => {
    process.exit(0);
});
