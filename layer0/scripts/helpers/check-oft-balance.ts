/**
 * Direct balance check on OFT contract
 */

import { ethers } from "hardhat";

async function main() {
    const [signer] = await ethers.getSigners();
    const address = signer.address;

    console.log("Checking address:", address);
    console.log("\nFXRP OFT Contract: 0x81672c5d42F3573aD95A0bdfBE824FaaC547d4E6");

    const oft = await ethers.getContractAt(
        ["function balanceOf(address) view returns (uint256)"],
        "0x81672c5d42F3573aD95A0bdfBE824FaaC547d4E6"
    );

    try {
        const balance = await oft.balanceOf(address);
        console.log("\nRaw balance:", balance.toString());
        console.log("Formatted (6 decimals):", ethers.utils.formatUnits(balance, 6), "FXRP");
    } catch (error) {
        console.error("Error:", error);
    }
}

main();
