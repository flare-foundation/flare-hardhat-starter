/**
 * Check the OFT/OFTAdapter configuration
 */

import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);
    console.log("Network:", hre.network.name);

    const COSTON2_EID = 40294;
    const SEPOLIA_EID = 40161;

    if (hre.network.name === "coston2") {
        const oftAdapter = await ethers.getContractAt(
            "FAssetOFTAdapter",
            "0x09e1e53d48A252e0cb4e8097216D4dC715D138Ed"
        );

        console.log("\n📋 Coston2 OFT Adapter Configuration");
        console.log("=====================================");

        // Check peer
        const peer = await oftAdapter.peers(SEPOLIA_EID);
        console.log(`\nPeer for Sepolia (EID ${SEPOLIA_EID}):`);
        console.log(`  ${peer}`);
        console.log(`  Expected: 0x00000000000000000000000081672c5d42f3573ad95a0bdfbe824faac547d4e6`);

        // Check owner
        const owner = await oftAdapter.owner();
        console.log(`\nOwner: ${owner}`);
        console.log(`Is you: ${owner.toLowerCase() === signer.address.toLowerCase()}`);

    } else if (hre.network.name === "sepolia") {
        const oft = await ethers.getContractAt(
            "FAssetOFT",
            "0x81672c5d42F3573aD95A0bdfBE824FaaC547d4E6"
        );

        console.log("\n📋 Sepolia FXRP OFT Configuration");
        console.log("===================================");

        // Check peer
        try {
            const peer = await oft.peers(COSTON2_EID);
            console.log(`\nPeer for Coston2 (EID ${COSTON2_EID}):`);
            console.log(`  ${peer}`);
            console.log(`  Expected: 0x00000000000000000000000009e1e53d48a252e0cb4e8097216d4dc715d138ed`);
        } catch (error) {
            console.log("\n❌ Cannot read peer (might not have permission)");
        }

        // Check owner
        try {
            const owner = await oft.owner();
            console.log(`\nOwner: ${owner}`);
            console.log(`Is you: ${owner.toLowerCase() === signer.address.toLowerCase()}`);
        } catch (error) {
            console.log("\n❌ Cannot read owner (might not have permission)");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
