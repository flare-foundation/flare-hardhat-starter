import { ethers, web3, run } from "hardhat";
import { formatUnits } from "ethers";

import { FAssetsRedeemInstance, IAssetManagerContract, ERC20Instance } from "../../typechain-types";

import { deployAndLinkLibrary } from "../../utils/library";

// yarn hardhat run scripts/fassets/redeem.ts --network coston2

const LOTS_TO_REDEEM = 1;
const UNDERLYING_ADDRESS = "rSHYuiEvsYsKR8uUHhBTuGP5zjRcGt4nm";

// Get the contract
const FAssetsRedeem = artifacts.require("FAssetsRedeem");
const AssetManagerRegistryLibrary = artifacts.require("AssetManagerRegistryLibrary");

const IERC20 = artifacts.require("IERC20");

async function deployAndVerifyContract() {
    // Deploy library and link to contract
    const { library, linkedContract: linkedFAssetsRedeem } = await deployAndLinkLibrary(
        FAssetsRedeem,
        AssetManagerRegistryLibrary
    );

    const fAssetsRedeem: FAssetsRedeemInstance = await linkedFAssetsRedeem.new();

    const fAssetsRedeemAddress = fAssetsRedeem.address;

    try {
        await run("verify:verify", {
            address: fAssetsRedeemAddress,
            constructorArguments: [],
            libraries: {
                AssetManagerRegistryLibrary: library.address,
            },
        });
    } catch (e: any) {
        console.log(e);
    }

    console.log("FAssetsRedeem deployed to:", fAssetsRedeemAddress);

    return fAssetsRedeem;
}

async function approveFAssets(fAssetsRedeem: any, amountToRedeem: string) {
    console.log("Approving FAssetsRedeem contract to spend FXRP...");
    const fxrpAddress = await fAssetsRedeem.getFXRPAddress();
    const fxrp: ERC20Instance = await IERC20.at(fxrpAddress);

    const approveTx = await fxrp.approve(await fAssetsRedeem.address, amountToRedeem);
    console.log("FXRP approval completed");
}

async function parseRedemptionEvents(transactionReceipt: any, fAssetsRedeem: any) {
    console.log("\nParsing events...", transactionReceipt.rawLogs);

    // Get AssetManager contract interface
    const assetManagerAddress = await fAssetsRedeem.getAssetManagerAddress();
    const assetManager = (await ethers.getContractAt("IAssetManager", assetManagerAddress)) as IAssetManagerContract;

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
