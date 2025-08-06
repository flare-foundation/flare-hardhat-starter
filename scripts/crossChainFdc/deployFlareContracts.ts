import { run } from "hardhat";
import fs from "fs";
import { sleep } from "../utils/core";
const AddressUpdater = artifacts.require("AddressUpdater");
const FdcVerification = artifacts.require("FdcVerification");

// yarn hardhat run scripts/crossChainFdc/deployFlareContracts.ts --network xrplEVMTestnet

const RELAY_ADDRESS = "0x72A35A930e2a35198FE8dEFf40e068B8D4b6CC78";

async function verifyContractWithRetry(address: string, args: any[], retries: number = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await run("verify:verify", {
                address: address,
                constructorArguments: args,
                force: true,
            });
            return;
        } catch (e: any) {
            console.log(e, "\n", "Remaining attempts:", retries - i, "\n");
            await sleep(10000);
        }
    }
}

async function deployAndVerifyAddressUpdater() {
    const args = [
        process.env.ACCOUNT_ADDRESS ?? "0x893baB99798BCF5e0faB09Ad5CE61872B951F0a5", // _governance
    ];
    const addressUpdater = await AddressUpdater.new(...args);
    await addressUpdater.addOrUpdateContractNamesAndAddresses(["Relay"], [RELAY_ADDRESS]);

    await verifyContractWithRetry(addressUpdater.address, args);
    return addressUpdater.address;
}

async function deployAndVerifyFdcVerification(addressUpdaterAddress: string) {
    const args = [
        addressUpdaterAddress, // _addressUpdater
        200, // _fdcProtocolId
    ];
    const fdcVerification = await FdcVerification.new(...args);

    try {
        await run("verify:verify", {
            address: fdcVerification.address,
            constructorArguments: args,
            force: true,
        });
    } catch (e: any) {
        console.log(e, "\n");
    }

    await fdcVerification.updateRelay();
    return fdcVerification.address;
}

function writeAddressesToFile(addresses: Map<string, string>) {
    const content = [];
    for (const [contractName, contractAddress] of addresses.entries()) {
        content.push(`export const address${contractName} = "${contractAddress}";`);
    }
    fs.writeFileSync("scripts/crossChainFdc/config.ts", content.join("\n"));
}

async function main() {
    const contractAddress = new Map<string, string>();

    contractAddress.set("AddressUpdater", await deployAndVerifyAddressUpdater());
    contractAddress.set("FdcVerification", await deployAndVerifyFdcVerification(contractAddress.get("AddressUpdater")));

    writeAddressesToFile(contractAddress);
}

void main().then(() => {
    process.exit(0);
});
