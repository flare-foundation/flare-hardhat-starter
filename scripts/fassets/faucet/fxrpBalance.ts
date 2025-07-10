import { formatUnits } from "ethers";
import { TokenFaucetInstance } from "../../../typechain-types";

// yarn hardhat run scripts/fassets/faucet/fxrpBalance.ts --network coston2

const TokenFaucet: TokenFaucetInstance = artifacts.require("TokenFaucet");

// AssetManager address on Flare Testnet Coston2 network
const FXRP_ADDRESS = "0x8b4abA9C4BD7DD961659b02129beE20c6286e17F";
const TOKEN_FAUCET_ADDRESS = "0xD5796ac33466bFAa9cBA703ac0E13994fDA77A53";

async function main() {
    const tokenFaucet: TokenFaucetInstance = await TokenFaucet.at(TOKEN_FAUCET_ADDRESS);

    const balance = await tokenFaucet.tokenBalance(FXRP_ADDRESS);
    const balanceInFXRP = formatUnits(balance.toString(), 6); // FXRP has 6 decimals
    console.log("FXRP balance:", balanceInFXRP, "FXRP");
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
