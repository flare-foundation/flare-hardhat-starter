import { ethers } from "hardhat";
import { FAssetsRedeemContract, FAssetsRedeemInstance } from "../../typechain-types";
import { IAssetManagerContract } from "../../typechain-types";


// AssetManager address on Songbird Testnet Coston network
const ASSET_MANAGER_ADDRESS = "0x56728e46908fB6FcC5BCD2cc0c0F9BB91C3e4D34";
const LOTS_TO_REDEEM = 1;
const UNDERLYING_ADDRESS = "rSHYuiEvsYsKR8uUHhBTuGP5zjRcGt4nm";
const FXRP = "0x36be8f2e1CC3339Cf6702CEfA69626271C36E2fd";

async function main() {
  console.log("Redeeming FAssets...");
  

  // Get the contract factory
  const FAssetsRedeem = await ethers.getContractFactory("FAssetsRedeem") as FAssetsRedeemContract;

  // Deploy the contract
  const fAssetsRedeem = await FAssetsRedeem.deploy(ASSET_MANAGER_ADDRESS) as FAssetsRedeemInstance;
  await fAssetsRedeem.waitForDeployment();
  const fAssetsRedeemAddress = await fAssetsRedeem.getAddress();
  console.log("FAssetsRedeem deployed to:", fAssetsRedeemAddress);

  const settings = await fAssetsRedeem.getSettings();
  const lotSize = settings[0];
  const decimals = settings[1];
  console.log("Lot size:", lotSize);
  console.log("Asset decimals:", decimals);

  const lotsToRedeem = (Number(lotSize) * Number(LOTS_TO_REDEEM));
  const requiredAmountInFXRP = Number(lotsToRedeem) / Math.pow(10, Number(decimals));
  console.log(`Required FXRP amount for ${LOTS_TO_REDEEM} lot: ${requiredAmountInFXRP} FXRP`);
  console.log(`Required amount in base units: ${lotsToRedeem.toString()}`);

  // Get FXRP token contract
  const fxrp = await ethers.getContractAt("IERC20", FXRP);
  
  // // Convert 20.02 FXRP to wei (assuming 18 decimals)
  
  // // Transfer FXRP to the deployed contract
  console.log("Transferring FXRP to contract...");
  const transferTx = await fxrp.transfer(fAssetsRedeemAddress, lotsToRedeem);
  await transferTx.wait();
  console.log("FXRP transfer completed");

  // console.log("Waiting for 20 seconds before verification...");
  // await new Promise(resolve => setTimeout(resolve, 20000));

  // console.log("Verifying contract...");
  
  // await run("verify:verify", {
  //   address: fAssetsRedeemAddress,
  //   constructorArguments: [blazeSwapRouter, assetManagerAddress, swapPath],
  // });

  // console.log("Contract verified successfully");

  // Call redeem function and wait for transaction
  const tx = await fAssetsRedeem.redeem(LOTS_TO_REDEEM, UNDERLYING_ADDRESS);
  const receipt = await tx.wait();
  console.log("TX receipt", receipt);

  // Get AssetManager contract interface
  const assetManager = await ethers.getContractAt("IAssetManager", ASSET_MANAGER_ADDRESS) as IAssetManagerContract;

  // Parse events from the transaction
  console.log("\nParsing events...", receipt.logs);
  
  for (const log of receipt.logs) {
    try {
      // Try to parse with AssetManager interface first
      const parsedLog = assetManager.interface.parseLog(log);
      if (parsedLog) {
        if (parsedLog.name === "RedemptionTicketUpdated" || parsedLog.name === "RedemptionRequested") {
          console.log(`\nEvent: ${parsedLog.name}`);
          console.log('Arguments:', parsedLog.args);
        }
      }
    } catch (e) {
      // If parsing fails with AssetManager interface, try FAssetsRedeem interface
      try {
        const parsedLog = fAssetsRedeem.interface.parseLog(log);
        if (parsedLog) {
          console.log(`\nEvent: ${parsedLog.name}`);
          console.log('Arguments:', parsedLog.args);
        }
      } catch (e) {
        // Skip logs that can't be parsed by either interface
        continue;
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});