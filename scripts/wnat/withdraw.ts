import { ethers } from "hardhat";

import { IWNatInstance } from "../../typechain-types/@flarenetwork/flare-periphery-contracts/coston2/IWNat";
import { IFlareContractRegistryInstance } from "typechain-types/@flarenetwork/flare-periphery-contracts/coston2/IFlareContractRegistry";

const FLARE_CONTRACTS_REGISTRY_ADDRESS = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

const iWNatArtifact = artifacts.require("IWNat");
const iFlareContractRegistryArtifact = artifacts.require("IFlareContractRegistry");


// Run with command
// npx hardhat run scripts/wnat/withdraw.ts --network coston2
async function main() {
  const contractRegistry: IFlareContractRegistryInstance = await iFlareContractRegistryArtifact.at(FLARE_CONTRACTS_REGISTRY_ADDRESS);
  const wnatAddress = await contractRegistry.getContractAddressByName("WNat");
  console.log(wnatAddress);

  const IWNatInstance: IWNatInstance = await iWNatArtifact.at(wnatAddress);

  const accounts = await web3.eth.getAccounts();
  const account = accounts[0];
  console.log("Using account:", account);

  // Get initial balance
  const initialBalance = await IWNatInstance.balanceOf(account);

  // Withdraw 0.1 ETH
  const withdrawAmount = ethers.parseEther("0.1").toString();
  const tx = await IWNatInstance.withdraw(withdrawAmount);
  const finalBalance = await IWNatInstance.balanceOf(account);

  // console.log("Withdrew from WNAT to native token", tx);
  console.log("Initial WNAT balance:", web3.utils.fromWei(initialBalance, 'ether'), "WNAT");
  console.log("Final WNAT balance:", web3.utils.fromWei(finalBalance, 'ether'), "WNAT");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

