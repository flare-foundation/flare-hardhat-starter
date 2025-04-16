import { ethers, run } from "hardhat";

import {
  FAssetsSwapAndRedeemInstance,
  ERC20Instance 
} from "../../typechain-types";

// AssetManager address on Songbird Testnet Coston network
const ASSET_MANAGER_ADDRESS = "0x56728e46908fB6FcC5BCD2cc0c0F9BB91C3e4D34";
const LOTS_TO_REDEEM = 1;
const UNDERLYING_ADDRESS = "rSHYuiEvsYsKR8uUHhBTuGP5zjRcGt4nm";
const FXRP_TOKEN_ADDRESS = "0x36be8f2e1CC3339Cf6702CEfA69626271C36E2fd";
const SWAP_ROUTER_ADDRESS = "0xf0D01450C037DB2903CF5Ff638Dd1e2e6B0EEDF4";
const SWAP_PATH = [
  "0x767b25A658E8FC8ab6eBbd52043495dB61b4ea91",
  "0x51B1ac96027e55c29Ece8a6fD99DdDdd01F22F6c"
];

async function deployAndVerifyContract() {
  const FAssetsSwapAndRedeem = artifacts.require("FAssetsSwapAndRedeem");
  const args = [SWAP_ROUTER_ADDRESS, ASSET_MANAGER_ADDRESS, SWAP_PATH];
  const fassetsSwapAndRedeem: FAssetsSwapAndRedeemInstance = await FAssetsSwapAndRedeem.new(...args);

  const fassetsSwapAndRedeemAddress = await fassetsSwapAndRedeem.address;

  // try {
  //   await run("verify:verify", {
  //     address: fassetsSwapAndRedeemAddress,
  //     constructorArguments: args,
  //   });
  // } catch (e: any) {
  //   console.log(e);
  // }

  console.log("FAssetsSwapAndRedeem deployed to:", fassetsSwapAndRedeemAddress);

  return fassetsSwapAndRedeem;
}

async function main() {
  const fassetsSwapAndRedeem: FAssetsSwapAndRedeemInstance = await deployAndVerifyContract();

  const fassetsSwapAndRedeemAddress = await fassetsSwapAndRedeem.address;
  const amounts = await fassetsSwapAndRedeem.calculateRedemptionAmountIn(LOTS_TO_REDEEM);
  const amountIn = amounts.amountIn;
  console.log("Amount of tokens out: ", amounts.amountOut.toString());
  console.log("Amount of tokens in: ", amounts.amountIn.toString());

  console.log("Token address: ", SWAP_PATH[0]);

  const fxrp = await ethers.getContractAt("IERC20", FXRP_TOKEN_ADDRESS) as ERC20Instance;
  
  
  const approveTx = await fxrp.approve(fassetsSwapAndRedeemAddress, amountIn);
  const approveReceipt = await approveTx.wait(); 

  // Swap and redeem
  const swapResult = await fassetsSwapAndRedeem.swapAndRedeem(LOTS_TO_REDEEM, UNDERLYING_ADDRESS);

  const swapAndRedeemReceipt = await swapResult.wait();
  console.log("Swap and redeem transaction: ", swapAndRedeemReceipt);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});