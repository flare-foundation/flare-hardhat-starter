import { run } from "hardhat";

import { SwapAndRedeemInstance } from "../../typechain-types";
import { ERC20Instance } from "../../typechain-types/@openzeppelin/contracts/token/ERC20/ERC20";

// yarn hardhat run scripts/fassets/swapAndRedeem.ts --network coston2

// AssetManager address on Flare Testnet Coston2 network
const ASSET_MANAGER_ADDRESS = "0xDeD50DA9C3492Bee44560a4B35cFe0e778F41eC5";
const LOTS_TO_REDEEM = 1;
const UNDERLYING_ADDRESS = "rSHYuiEvsYsKR8uUHhBTuGP5zjRcGt4nm";

// BlazeSwap router address on Flare Testnet Coston2 network
const SWAP_ROUTER_ADDRESS = "0x8D29b61C41CF318d15d031BE2928F79630e068e6";
const SWAP_PATH = [
    "0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273", // WC2FLR
    "0x8b4abA9C4BD7DD961659b02129beE20c6286e17F", // FXRP
];

async function deployAndVerifyContract() {
    const SwapAndRedeem = artifacts.require("SwapAndRedeem");
    const args = [SWAP_ROUTER_ADDRESS, ASSET_MANAGER_ADDRESS, SWAP_PATH];
    const swapAndRedeem: SwapAndRedeemInstance = await SwapAndRedeem.new(...args);

    const fassetsSwapAndRedeemAddress = await swapAndRedeem.address;

    try {
        await run("verify:verify", {
            address: fassetsSwapAndRedeemAddress,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }

    console.log("FAssetsSwapAndRedeem deployed to:", fassetsSwapAndRedeemAddress);

    return swapAndRedeem;
}

async function main() {
    const swapAndRedeem: SwapAndRedeemInstance = await deployAndVerifyContract();

    const swapAndRedeemAddress = await swapAndRedeem.address;
    const amounts = await swapAndRedeem.calculateRedemptionAmountIn(LOTS_TO_REDEEM);
    const amountIn = amounts.amountIn;
    const amountOut = amounts.amountOut;
    console.log("Amount of tokens out (FXRP): ", amountOut.toString());
    console.log("Amount of tokens in (WCFLR): ", amountIn.toString());

    // Get WCFLR token
    const ERC20 = artifacts.require("ERC20");
    const wcflr: ERC20Instance = await ERC20.at(SWAP_PATH[0]);

    const approveTx = await wcflr.approve(swapAndRedeemAddress, amountOut);
    console.log("Approve transaction: ", approveTx);

    // Swap and redeem
    const swapResult = await swapAndRedeemAddress.swapAndRedeem(LOTS_TO_REDEEM, UNDERLYING_ADDRESS);
    console.log("Swap and redeem transaction: ", swapResult);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
