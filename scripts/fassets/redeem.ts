import { ethers, web3, run } from "hardhat";
import { formatUnits } from "ethers";

import { FAssetsRedeemInstance, IAssetManagerContract, ERC20Instance } from "../../typechain-types";

// yarn hardhat run scripts/fassets/redeem.ts --network coston2

// AssetManager address on Flare Testnet Coston2 network
const ASSET_MANAGER_ADDRESS = "0xDeD50DA9C3492Bee44560a4B35cFe0e778F41eC5";
const LOTS_TO_REDEEM = 1;
const UNDERLYING_ADDRESS = "rSHYuiEvsYsKR8uUHhBTuGP5zjRcGt4nm";

const FAssetsRedeem = artifacts.require("FAssetsRedeem");

const IAssetManager = artifacts.require("IAssetManager");
const IERC20 = artifacts.require("IERC20");

async function getFXRPAddress() {
    const assetManager = await IAssetManager.at(ASSET_MANAGER_ADDRESS);
    const fasset = await assetManager.fAsset();
    return fasset;
}

async function deployAndVerifyContract() {
    // Get FXRP address first
    const fxrpAddress = await getFXRPAddress();
    console.log("FXRP address:", fxrpAddress);

    const args = [ASSET_MANAGER_ADDRESS, fxrpAddress];
    const fAssetsRedeem: FAssetsRedeemInstance = await FAssetsRedeem.new(...args);

    const fAssetsRedeemAddress = await fAssetsRedeem.address;

    try {
        await run("verify:verify", {
            address: fAssetsRedeem.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }

    console.log("FAssetsRedeem deployed to:", fAssetsRedeemAddress);

    return fAssetsRedeem;
}

async function transferFXRP(fAssetsRedeemAddress: string, amountToRedeem: string) {
    const fxrpAddress = await getFXRPAddress();
    // Get FXRP token contract
    const fxrp: ERC20Instance = await IERC20.at(fxrpAddress);

    // Transfer FXRP to the deployed contract
    console.log("Transferring FXRP to contract...");
    const transferTx = await fxrp.transfer(fAssetsRedeemAddress, amountToRedeem);
    console.log("FXRP transfer completed");
}

async function approveFAssets(fAssetsRedeem: any, amountToRedeem: string) {
    console.log("Approving FAssetsRedeem contract to spend FXRP...");
    const fxrpAddress = await getFXRPAddress();
    const fxrp: ERC20Instance = await IERC20.at(fxrpAddress);

    const approveTx = await fxrp.approve(await fAssetsRedeem.address, amountToRedeem);
    console.log("FXRP approval completed");
}

async function parseRedemptionEvents(transactionReceipt: any, fAssetsRedeem: any) {
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
    const fAssetsRedeem = await deployAndVerifyContract();

    // Get the lot size and decimals to calculate the amount to redeem
    const settings = await fAssetsRedeem.getSettings();
    const lotSize = settings[0];
    const decimals = settings[1];
    console.log("Lot size:", lotSize.toString());
    console.log("Asset decimals:", decimals.toString());

    // Calculate the amount to redeem according to the lot size and the number of lots to redeem
    const amountToRedeem = web3.utils.toBN(lotSize).mul(web3.utils.toBN(LOTS_TO_REDEEM));
    console.log(`Required FXRP amount ${formatUnits(amountToRedeem.toString(), Number(decimals))} FXRP`);
    console.log(`Required amount in base units: ${amountToRedeem.toString()}`);

    // Approve FXRP for redemption
    await approveFAssets(fAssetsRedeem, amountToRedeem.toString());

    // Call redeem function and wait for transaction
    const redeemTx = await fAssetsRedeem.redeem(LOTS_TO_REDEEM, UNDERLYING_ADDRESS);
    // const receipt = await tx.wait();
    console.log("Redeem transaction receipt", redeemTx);

    // // Parse events from the transaction
    await parseRedemptionEvents(redeemTx.receipt, fAssetsRedeem);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
