import { ethers, run } from "hardhat";

import { FAssetsRedeemContract, FAssetsRedeemInstance } from "../../typechain-types";
import { IAssetManagerContract } from "../../typechain-types";
import { ERC20Instance, ERC20Contract,  } from "../../typechain-types";

// AssetManager address on Songbird Testnet Coston network
const ASSET_MANAGER_ADDRESS = "0x56728e46908fB6FcC5BCD2cc0c0F9BB91C3e4D34";
const LOTS_TO_REDEEM = 1;
const UNDERLYING_ADDRESS = "rSHYuiEvsYsKR8uUHhBTuGP5zjRcGt4nm";
const FXRP_ADDRESS = "0x36be8f2e1CC3339Cf6702CEfA69626271C36E2fd";

async function deployAndVerifyContract() {
  const FAssetsRedeem = await ethers.getContractFactory("FAssetsRedeem") as FAssetsRedeemContract;

  const args = [ASSET_MANAGER_ADDRESS];
  const fAssetsRedeem = await FAssetsRedeem.deploy(...args) as FAssetsRedeemInstance;
  await fAssetsRedeem.waitForDeployment();
  const fAssetsRedeemAddress = await fAssetsRedeem.getAddress();
  
  try {
    await run("verify:verify", {
      address: fAssetsRedeemAddress,
      constructorArguments: args,
    });
  } catch (e: any) {
    console.log(e);
  }

  console.log("FAssetsRedeem deployed to:", fAssetsRedeemAddress);

  return fAssetsRedeem;
}

async function transferFXRP(fAssetsRedeem: FAssetsRedeemInstance, amountToRedeem: number) {
  // Get FXRP token contract
  const ERC20Factory = await ethers.getContractFactory("ERC20") as ERC20Contract;
  const fxrp = await ERC20Factory.attach(FXRP_ADDRESS) as ERC20Instance;
  
  // Transfer FXRP to the deployed contract
  console.log("Transferring FXRP to contract...");
  const transferTx = await fxrp.transfer(fAssetsRedeem.address, amountToRedeem);
  await transferTx.wait();
  console.log("FXRP transfer completed");
}

async function parseRedemptionEvents(transactionReceipt: any, fAssetsRedeem: FAssetsRedeemInstance) {
  console.log("\nParsing events...", transactionReceipt.logs);

  // Get AssetManager contract interface
  const assetManager = await ethers.getContractAt("IAssetManager", ASSET_MANAGER_ADDRESS) as IAssetManagerContract;
  
  for (const log of transactionReceipt.logs) {
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
      console.log("Error parsing event:", e);
    }
  }
}

async function main() {
  const fAssetsRedeem: FAssetsRedeemInstance = await deployAndVerifyContract();
  
  const settings = await fAssetsRedeem.getSettings();
  const lotSize = settings[0];
  const decimals = settings[1];
  console.log("Lot size:", lotSize);
  console.log("Asset decimals:", decimals);

  const amountToRedeem = (Number(lotSize) * Number(LOTS_TO_REDEEM));
  const requiredAmountInFXRP = Number(amountToRedeem) / Math.pow(10, Number(decimals));
  console.log(`Required FXRP amount for ${LOTS_TO_REDEEM} lot: ${requiredAmountInFXRP} FXRP`);
  console.log(`Required amount in base units: ${amountToRedeem.toString()}`);

  // Transfer FXRP to the contract
  await transferFXRP(fAssetsRedeem, amountToRedeem);

  // Call redeem function and wait for transaction
  const tx = await fAssetsRedeem.redeem(LOTS_TO_REDEEM, UNDERLYING_ADDRESS);
  const transactionReceipt = await tx.wait();
  console.log("TX receipt", transactionReceipt);

  // Parse events from the transaction
  await parseRedemptionEvents(transactionReceipt, fAssetsRedeem);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});