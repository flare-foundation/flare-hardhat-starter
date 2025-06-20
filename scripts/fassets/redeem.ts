import { ethers, run } from "hardhat";
import { formatUnits } from "ethers";

import { FAssetsRedeemInstance, IAssetManagerContract, ERC20Instance } from "../../typechain-types";

// yarn hardhat run scripts/fassets/redeem.ts --network coston2

// AssetManager address on Flare Testnet Coston2 network
const ASSET_MANAGER_ADDRESS = "0xDeD50DA9C3492Bee44560a4B35cFe0e778F41eC5";
const LOTS_TO_REDEEM = 1;
const UNDERLYING_ADDRESS = "rSHYuiEvsYsKR8uUHhBTuGP5zjRcGt4nm";

async function deployAndVerifyContract() {
    const FAssetsRedeem = artifacts.require("FAssetsRedeem");
    const args = [ASSET_MANAGER_ADDRESS];
    const fAssetsRedeem: FAssetsRedeemInstance = await FAssetsRedeem.new(...args);

    const fAssetsRedeemAddress = await fAssetsRedeem.address;

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

async function getFXRPAddress() {
    const assetManager = await IAssetManager.at(ASSET_MANAGER_ADDRESS);
    const fasset = await assetManager.fAsset();
    return fasset;
}

async function transferFXRP(fAssetsRedeemAddress: string, amountToRedeem: number) {
    const fxrpAddress = await getFXRPAddress();
    // Get FXRP token contract
    const fxrp = (await ethers.getContractAt("IERC20", fxrpAddress)) as ERC20Instance;

    // Transfer FXRP to the deployed contract
    console.log("Transferring FXRP to contract...");
    const transferTx = await fxrp.transfer(fAssetsRedeemAddress, amountToRedeem);
    await transferTx.wait();
    console.log("FXRP transfer completed");
}

async function parseRedemptionEvents(transactionReceipt: any, fAssetsRedeem: FAssetsRedeemInstance) {
    console.log("\nParsing events...", transactionReceipt.rawLogs);

    // Get AssetManager contract interface
    const assetManager = (await ethers.getContractAt("IAssetManager", ASSET_MANAGER_ADDRESS)) as IAssetManagerContract;

    for (const log of transactionReceipt.rawLogs) {
        try {
            // Try to parse the log using the AssetManager interface
            const parsedLog = assetManager.interface.parseLog({
                topics: log.topics,
                data: log.data,
            });

            if (parsedLog) {
                const redemptionEvents = ["RedemptionRequested", "RedemptionTicketUpdated"];
                if (redemptionEvents.includes(parsedLog.name)) {
                    console.log(`\nEvent: ${parsedLog.name}`);
                    console.log("Arguments:", parsedLog.args);
                }
            }
        } catch (e) {
            console.log("Error parsing event:", e);
        }
    }
}

async function main() {
    // Deploy and verify the contract
    const fAssetsRedeem: FAssetsRedeemInstance = await deployAndVerifyContract();

    // Get the lot size and decimals to calculate the amount to redeem
    const settings = await fAssetsRedeem.getSettings();
    const lotSize = settings[0];
    const decimals = settings[1];
    console.log("Lot size:", lotSize.toString());
    console.log("Asset decimals:", decimals.toString());

    // Calculate the amount to redeem according to the lot size and the number of lots to redeem
    const amountToRedeem = Number(lotSize) * Number(LOTS_TO_REDEEM);
    console.log(`Required FXRP amount ${formatUnits(amountToRedeem, Number(decimals))} FXRP`);
    console.log(`Required amount in base units: ${amountToRedeem.toString()}`);

    // Transfer FXRP to the contract
    await transferFXRP(fAssetsRedeem.address, amountToRedeem);

    // Call redeem function and wait for transaction
    const tx = await fAssetsRedeem.redeem(LOTS_TO_REDEEM, UNDERLYING_ADDRESS);
    console.log("TX receipt", tx.receipt);

    // Parse events from the transaction
    await parseRedemptionEvents(tx.receipt, fAssetsRedeem);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
