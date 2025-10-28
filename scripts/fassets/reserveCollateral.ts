import { getAssetManagerFXRP } from "../utils/getters";
import { IAssetManagerInstance } from "../../typechain-types";
import { logEvents } from "../../scripts/utils/core";

// yarn hardhat run scripts/fassets/reserveCollateral.ts --network coston2

// Number of lots to reserve
const LOTS_TO_MINT = 1;
// Use zero address for executor since we're not using it
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const AssetManager = artifacts.require("IAssetManager");

// Function from FAssets Bot repository
// https://github.com/flare-foundation/fasset-bots/blob/main/packages/fasset-bots-core/src/commands/InfoBotCommands.ts#L83
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
        let optimal = agentsWithLots.filter((a) => a.feeBIPS === lowestFee);

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
            optimal = optimal.filter((a) => a.agentVault !== agentVault);
            agentsWithLots = agentsWithLots.filter((a) => a.agentVault !== agentVault);
        }
    }
}

function parseCollateralReservedEvent(transactionReceipt: any) {
    console.log("\nParsing events...", transactionReceipt.rawLogs);

    const collateralReservedEvents = logEvents(transactionReceipt.rawLogs, "CollateralReserved", AssetManager.abi);

    return collateralReservedEvents[0].decoded;
}

async function main() {
    // Initialize the FAssets FXRP AssetManager contract

    const assetManager: IAssetManagerInstance = await getAssetManagerFXRP();

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

    console.log("agentVaultAddress", agentVaultAddress);
    console.log("LOTS_TO_MINT", LOTS_TO_MINT);
    console.log("agentInfo.feeBIPS", agentInfo.feeBIPS);
    console.log("ZERO_ADDRESS", ZERO_ADDRESS);

    console.log("collateralReservationFee", collateralReservationFee);

    // Reserve collateral
    // https://dev.flare.network/fassets/reference/IAssetManager#reservecollateral
    const tx = await assetManager.reserveCollateral(
        agentVaultAddress,
        LOTS_TO_MINT,
        agentInfo.feeBIPS,
        // Not using the executor
        ZERO_ADDRESS,
        // Sending the collateral reservation fee as native tokens
        { value: collateralReservationFee }
    );

    console.log("Collateral reservation successful:", tx);

    const decimals = await assetManager.assetMintingDecimals();

    // Parse the CollateralReserved event
    const collateralReservedEvent = parseCollateralReservedEvent(tx.receipt);

    const collateralReservationInfo = await assetManager.collateralReservationInfo(
        collateralReservedEvent.collateralReservationId
    );
    console.log("Collateral reservation info:", collateralReservationInfo);

    const valueUBA = BigInt(collateralReservedEvent.valueUBA.toString());
    const feeUBA = BigInt(collateralReservedEvent.feeUBA.toString());
    const totalUBA = valueUBA + feeUBA;
    const totalXRP = Number(totalUBA) / 10 ** decimals;
    console.log(`You need to pay ${totalXRP} XRP`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
