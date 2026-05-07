import { web3 } from "hardhat";
import { RouletteInstance } from "../../typechain-types";
import { ERC20Instance } from "../../typechain-types/@openzeppelin/contracts/token/ERC20/ERC20";
import { getFXRPTokenAddress } from "../utils/fassets";
import { rouletteAddress } from "./deploys";

const Roulette = artifacts.require("Roulette");
// @ts-expect-error - Type definitions issue, but works at runtime
const IERC20 = artifacts.require("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20");

// yarn hardhat run scripts/roulette/fund.ts --network coston2
//
// Funds the deployed Roulette contract's house bankroll with FXRP. Only the
// contract owner can call `fundHouse`; the caller must already hold at least
// FUND_AMOUNT FXRP. The Roulette address is read from scripts/roulette/deploys.ts,
// which is auto-written by scripts/roulette/deploy.ts. Required env var:
//   FUND_AMOUNT — FXRP amount in whole tokens (e.g. "100" → 100 FXRP)

async function fundHouse() {
    if (!rouletteAddress) {
        throw new Error(
            "rouletteAddress is empty in scripts/roulette/deploys.ts — run scripts/roulette/deploy.ts first"
        );
    }
    const fundAmountTokens = process.env.FUND_AMOUNT;
    if (!fundAmountTokens) {
        throw new Error('FUND_AMOUNT env var is required (whole FXRP, e.g. "100")');
    }

    const [deployer] = await web3.eth.getAccounts();
    const fxrpAddress = await getFXRPTokenAddress();
    const roulette = (await Roulette.at(rouletteAddress)) as RouletteInstance;
    const fxrp = (await IERC20.at(fxrpAddress)) as ERC20Instance;

    const owner = await roulette.owner();
    if (owner.toLowerCase() !== deployer.toLowerCase()) {
        throw new Error(`Caller ${deployer} is not the Roulette owner (${owner})`);
    }

    const decimals = (await fxrp.decimals()).toNumber();
    const amount = BigInt(fundAmountTokens) * 10n ** BigInt(decimals);

    const balance = BigInt((await fxrp.balanceOf(deployer)).toString());
    if (balance < amount) {
        throw new Error(`Insufficient FXRP: have ${balance}, need ${amount}`);
    }

    console.log("Roulette:        ", rouletteAddress);
    console.log("Owner / sender:  ", deployer);
    console.log("FXRP:            ", fxrpAddress, `(decimals=${decimals})`);
    console.log("Funding amount:  ", amount.toString(), `(= ${fundAmountTokens} FXRP)`);

    const houseBefore = BigInt((await roulette.houseFunds()).toString());
    console.log("House funds before:", houseBefore.toString());

    const approveTx = await fxrp.approve(rouletteAddress, amount.toString(), { from: deployer });
    console.log("Approve tx:", approveTx.tx);

    const fundTx = await roulette.fundHouse(amount.toString(), { from: deployer });
    console.log("fundHouse tx:", fundTx.tx);

    const houseAfter = BigInt((await roulette.houseFunds()).toString());
    console.log("House funds after: ", houseAfter.toString());
    console.log("Funded:            ", (houseAfter - houseBefore).toString());
}

void fundHouse().then(() => {
    process.exit(0);
});
