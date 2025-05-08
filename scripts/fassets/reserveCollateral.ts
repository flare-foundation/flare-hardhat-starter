import { ethers } from "hardhat";

import { IAssetManagerInstance, IAssetManagerContract } from "../../typechain-types";

// AssetManager address on Songbird Testnet Coston network
const ASSET_MANAGER_ADDRESS = "0x56728e46908fB6FcC5BCD2cc0c0F9BB91C3e4D34";
// Number of lots to reserve
const LOTS_TO_MINT = 1;
// XRP Ledger address
const UNDERLYING_ADDRESS = "rSHYuiEvsYsKR8uUHhBTuGP5zjRcGt4nm";

// Use zero address for executor since we're not using it
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Function from FAssets Bot repository
// https://github.com/flare-labs-ltd/fasset-bots/blob/main/packages/fasset-bots-core/src/commands/InfoBotCommands.ts#L83
async function findBestAgent(assetManager: IAssetManagerInstance, minAvailableLots = 1) {
  // get max 100 agents
  const agents = (await assetManager.getAvailableAgentsDetailedList(0, 100))._agents;

  // filter agents with enough free collateral lots
  let agentsWithLots = agents.filter((agent) => agent.freeCollateralLots > minAvailableLots);
  
  if (agentsWithLots.length === 0) {
    return undefined;
  }

  // sort by lowest fee
  agentsWithLots.sort((a, b) => a.feeBIPS - b.feeBIPS);

  while (agentsWithLots.length > 0) {
      const lowestFee = agentsWithLots[0].feeBIPS;
      
      // get all agents with the lowest fee
      let optimal = agentsWithLots.filter((a) => a.feeBIPS == lowestFee);

      while (optimal.length > 0) {
          // const agentVault = (requireNotNull(randomChoice(optimal)) as any).agentVault;  // list must be nonempty

          // get a random agent from the list
          const agentVault = optimal[Math.floor(Math.random() * optimal.length)].agentVault;
          // const agentVault = (randomChoice(optimal) as any).agentVault;

          const info = await assetManager.getAgentInfo(agentVault);
          // 0 = NORMAL
          if (Number(info.status) === 0) {
              return agentVault;
          }
          // If not found remote this agent and do another round
          optimal = optimal.filter(a => a.agentVault !== agentVault);
          agentsWithLots = agentsWithLots.filter(a => a.agentVault !== agentVault);
      }
  }
}

/*
event CollateralReserved(
        address indexed agentVault,
        address indexed minter,
        uint256 indexed collateralReservationId,
        uint256 valueUBA,
        uint256 feeUBA,
        uint256 firstUnderlyingBlock,
        uint256 lastUnderlyingBlock,
        uint256 lastUnderlyingTimestamp,
        string paymentAddress,
        bytes32 paymentReference,
        address executor,
        uint256 executorFeeNatWei);
*/
type CollateralReservedEvent = {
  agentVault: string;
  minter: string;
  collateralReservationId: bigint;
  valueUBA: bigint;
  feeUBA: bigint;
  firstUnderlyingBlock: bigint;
  lastUnderlyingBlock: bigint;
  lastUnderlyingTimestamp: bigint;
  paymentAddress: string;
  paymentReference: string; // bytes32 as hex string
  executor: string;
  executorFeeNatWei: bigint;
};

async function parseCollateralReservedEvent(transactionReceipt: any) {
  console.log("\nParsing events...", transactionReceipt.rawLogs);

  const assetManager = (await ethers.getContractAt("IAssetManager", ASSET_MANAGER_ADDRESS)) as IAssetManagerContract;

  for (const log of transactionReceipt.rawLogs) {
    try {
      const parsedLog = assetManager.interface.parseLog({
        topics: log.topics,
        data: log.data,
      });

      if (parsedLog) {
        const collateralReservedEvents = ["CollateralReserved"];

        if (collateralReservedEvents.includes(parsedLog.name)) {
            console.log(`\nEvent: ${parsedLog.name}`);
            console.log("Arguments:", parsedLog.args);
            const collateralReservedEvent = parsedLog.args as CollateralReservedEvent;

            console.log("agentVault:", collateralReservedEvent.agentVault);
            console.log("minter:", collateralReservedEvent.minter);
            console.log("collateralReservationId:", collateralReservedEvent.collateralReservationId.toString());
            console.log("valueUBA:", collateralReservedEvent.valueUBA.toString());
            console.log("feeUBA:", collateralReservedEvent.feeUBA.toString());
            console.log("firstUnderlyingBlock:", collateralReservedEvent.firstUnderlyingBlock.toString());
            console.log("lastUnderlyingBlock:", collateralReservedEvent.lastUnderlyingBlock.toString());
            console.log("lastUnderlyingTimestamp:", collateralReservedEvent.lastUnderlyingTimestamp.toString());
            console.log("paymentAddress:", collateralReservedEvent.paymentAddress);
            console.log("paymentReference:", collateralReservedEvent.paymentReference);
            console.log("executor:", collateralReservedEvent.executor);
            console.log("executorFeeNatWei:", collateralReservedEvent.executorFeeNatWei.toString());
        }
    }
    } catch (e) {
      console.log("Error parsing event:", e);
    }
  }
}

async function main() {
  // Initialize the FAssets FXRP AssetManager contract
  const AssetManager = artifacts.require("IAssetManager");
  const assetManager: IAssetManagerInstance = await AssetManager.at(ASSET_MANAGER_ADDRESS);

  // Find the best agent with enough free collateral lots
  const agentVaultAddress = await findBestAgent(assetManager, LOTS_TO_MINT);
  if (!agentVaultAddress) {
    throw new Error("No suitable agent found with enough free collateral lots");
  }
  console.log(agentVaultAddress);

  // Get the agent info
  const agentInfo = await assetManager.getAgentInfo(agentVaultAddress);
  console.log("Agent info:", agentInfo);

  // Get the collateral reservation fee according to the number of lots to reserve
  // https://dev.flare.network/fassets/minting/#collateral-reservation-fee
  const collateralReservationFee = await assetManager.collateralReservationFee(LOTS_TO_MINT);
  console.log("Collateral reservation fee:", collateralReservationFee.toString());

  const IAssetManager = artifacts.require("IAssetManager");
  const iAssetManager: IAssetManagerInstance = await IAssetManager.at(ASSET_MANAGER_ADDRESS);

  
  // Reserve collateral
  // https://dev.flare.network/fassets/reference/IAssetManager#reservecollateral
  const tx = await iAssetManager.reserveCollateral(
    agentVaultAddress, 
    LOTS_TO_MINT, 
    agentInfo.feeBIPS, 
    // Not using the executor
    ZERO_ADDRESS,
    [UNDERLYING_ADDRESS],
    // Sending the collateral reservation fee as native tokens
    { value: collateralReservationFee }
  );

  console.log("Collateral reservation successful:", tx);

  // Parse the CollateralReserved event
  await parseCollateralReservedEvent(tx.receipt);
}

// 1. Reserve collateral
// Collateral reservation ID is collateralReservationId from CollateralReserved event


// 2. Send payment on XRP Ledger
// Details from CollateralReserved event
// * recipient address - paymentAddress
// * reference paymentReference

// 3. Get payment proof
// https://dev.flare.network/fdc/guides/hardhat/payment#retrieve-data-and-proof
// https://github.com/flare-foundation/flare-hardhat-starter/blob/master/scripts/fdcExample/Payment.ts

// 4. Execute minting

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});