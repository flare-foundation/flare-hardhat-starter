import { ethers } from "hardhat";

import { getFXRPAssetManagerAddress } from "../utils/fassets";
import { IAssetManagerInstance, IAssetManagerContract } from "../../typechain-types";

// yarn hardhat run scripts/fassets/reserveCollateral.ts --network coston2

// Number of lots to reserve
const LOTS_TO_MINT = 1;
// XRP Ledger address
const UNDERLYING_ADDRESS = "rSHYuiEvsYsKR8uUHhBTuGP5zjRcGt4nm";

// Use zero address for executor since we're not using it
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Function from FAssets Bot repository
// https://github.com/flare-foundation/fasset-bots/blob/main/packages/fasset-bots-core/src/commands/InfoBotCommands.ts#L83
async function findBestAgent(assetManager: IAssetManagerInstance, minAvailableLots = 1) {
    // get max 100 agents
    const agents = (await assetManager.getAvailableAgentsDetailedList(0, 100))._agents;

    // filter agents with enough free collateral lots
    let agentsWithLots = agents.filter(agent => agent.freeCollateralLots > minAvailableLots);

    if (agentsWithLots.length === 0) {
        return undefined;
    }

    // sort by lowest fee
    agentsWithLots.sort((a, b) => a.feeBIPS - b.feeBIPS);

    while (agentsWithLots.length > 0) {
        const lowestFee = agentsWithLots[0].feeBIPS;

        // get all agents with the lowest fee
        let optimal = agentsWithLots.filter(a => a.feeBIPS == lowestFee);

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

async function parseCollateralReservedEvent(transactionReceipt: any, decimals: number) {
    console.log("\nParsing events...", transactionReceipt.rawLogs);

    // Get AssetManager contract interface
    const assetManagerAddress = await getFXRPAssetManagerAddress();
    const assetManager = (await ethers.getContractAt("IAssetManager", assetManagerAddress)) as IAssetManagerContract;

    for (const log of transactionReceipt.rawLogs) {
        try {
            const parsedLog = assetManager.interface.parseLog({
                topics: log.topics,
                data: log.data,
            });

            if (!parsedLog) continue;

            const collateralReservedEvents = ["CollateralReserved"];
            if (!collateralReservedEvents.includes(parsedLog.name)) continue;

            console.log(`\nEvent: ${parsedLog.name}`);
            console.log("Arguments:", parsedLog.args);
            const collateralReservedEvent = parsedLog.args;

            return collateralReservedEvent;
        } catch (e) {
            console.log("Error parsing event:", e);
        }
    }
}

async function main() {
    // Initialize the FAssets FXRP AssetManager contract
    const AssetManager = artifacts.require("IAssetManager");
    const assetManagerAddress = await getFXRPAssetManagerAddress();
    const assetManager: IAssetManagerInstance = await AssetManager.at(assetManagerAddress);

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

    // Reserve collateral
    // https://dev.flare.network/fassets/reference/IAssetManager#reservecollateral
    const tx = await assetManager.reserveCollateral(
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

    const decimals = await assetManager.assetMintingDecimals();

    // Parse the CollateralReserved event
    const collateralReservedEvent = await parseCollateralReservedEvent(tx.receipt, decimals);

    const collateralReservationInfo = await assetManager.collateralReservationInfo(
        collateralReservedEvent.collateralReservationId
    );
    console.log("Collateral reservation info:", collateralReservationInfo);

    const totalUBA = collateralReservedEvent.valueUBA + collateralReservedEvent.feeUBA;
    const totalXRP = Number(totalUBA) / 10 ** decimals;
    console.log(`You need to pay ${totalXRP} XRP`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
