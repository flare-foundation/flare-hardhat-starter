import { ethers } from "hardhat";

import { IAssetManagerInstance } from "../../typechain-types";

const ASSET_MANAGER_ADDRESS = "0x56728e46908fB6FcC5BCD2cc0c0F9BB91C3e4D34";

async function main() {
  const assetManager: IAssetManagerInstance = await ethers.getContractAt("IAssetManager", ASSET_MANAGER_ADDRESS);
  const settings = await assetManager.getSettings();
  console.log("Settings: ", settings);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});