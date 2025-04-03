import { ethers } from "hardhat";
import { FAssetsSettingsContract } from "../../typechain-types";

// 1. AssetManager address on Songbird Testnet Coston network
const ASSET_MANAGER_ADDRESS = "0x56728e46908fB6FcC5BCD2cc0c0F9BB91C3e4D34";

async function main() {
  console.log("Deploying FAssetsSettings...");

  //2.  Get the contract factory
  const FAssetsSettings = await ethers.getContractFactory("FAssetsSettings") as FAssetsSettingsContract;

  //3. Deploy the contract
  const fAssetsSettings = await FAssetsSettings.deploy(ASSET_MANAGER_ADDRESS);
  await fAssetsSettings.waitForDeployment();
  console.log("FAssetsSettings deployed to:", await fAssetsSettings.getAddress());

  // 4. Call getSettings function
  const lotSize = await fAssetsSettings.getLotSize();
  console.log("Lot size:", lotSize[0]);
  console.log("Decimals:", lotSize[1]);

  // 5. Convert lot size to XRP
  const lotSizeFXRP = Number(lotSize[0]) / Math.pow(10, Number(lotSize[1]));
  console.log("Lot size in XRP", lotSizeFXRP)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});