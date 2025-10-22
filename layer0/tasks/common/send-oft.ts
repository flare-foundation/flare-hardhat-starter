import { Options } from "@layerzerolabs/lz-v2-utilities";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import assert from "node:assert";
import { FAssetOFT, FAssetOFTAdapter, IERC20 } from '../../typechain-ethers';
import { SendParamStruct } from "../../typechain-ethers/contracts/FAssetOFT";
import { EthersFactory } from '../ethers-factory';
import { filterLogs, formatEvent, waitForConfirmations } from "../ethers-utils";
import { requiredEnvironmentVariable } from "../common-utils";

const FAssetOFTAdapter = new EthersFactory<FAssetOFTAdapter>('FAssetOFTAdapter');
const FAssetOFT = new EthersFactory<FAssetOFT>('FAssetOFT');
const IERC20 = new EthersFactory<IERC20>('IERC20');

const DEFAULT_EXECUTOR_GAS = 200_000;
const DEFAULT_HYPERLIQUID_COMPOSER_GAS = 150_000;

export interface SendToHypercoreOpts {
    gas?: string;
    value?: string;
}

export async function sendOFTTokens(hre: HardhatRuntimeEnvironment, fromAddress: string, toAddress: string, targetNetwork: string, amount: string, minAmount?: string, sendToHypercore?: SendToHypercoreOpts) {
    const targetEid = hre.config.networks[targetNetwork]?.eid;
    assert(targetEid != null, `Invalid target network ${targetNetwork}`);

    const sourceOftAdapterDeploy = await hre.deployments.getOrNull("FAssetOFTAdapter");
    const sourceOftDeploy = await hre.deployments.getOrNull("FXRPOFT");
    const composerAddress = requiredEnvironmentVariable("HYPERLIQUID_COMPOSER");

    const fromSigner = await ethers.getSigner(fromAddress);

    let options = Options.newOptions()
        .addExecutorLzReceiveOption(DEFAULT_EXECUTOR_GAS, 0);
    let composeMsg = "0x";
    let targetAddress = toAddress;

    if (sendToHypercore) {
        const composeGas = sendToHypercore.gas ?? DEFAULT_HYPERLIQUID_COMPOSER_GAS;
        const composeValue = sendToHypercore.value ?? "0";
        options = options.addExecutorComposeOption(0, composeGas, composeValue);
        composeMsg = ethers.utils.defaultAbiCoder.encode(["uint256", "address"], [composeValue, toAddress]);
        targetAddress = composerAddress;
    }

    const amountLD = amount;
    const minAmountLD = minAmount ? minAmount : amountLD;

    const sendParam = {
        dstEid: targetEid,
        to: ethers.utils.zeroPad(targetAddress, 32),
        amountLD: amountLD,
        minAmountLD: minAmountLD,
        extraOptions: options.toHex(),
        composeMsg: composeMsg,
        oftCmd: '0x',
    };

    if (sourceOftAdapterDeploy != null) {
        const oftAdapter = await FAssetOFTAdapter.attach(sourceOftAdapterDeploy.address);
        const token = await IERC20.attach(await oftAdapter.token());
        // Approve the FAsset tokens to be spent by the fAssetOFTAdapter contract
        await waitForConfirmations(token.connect(fromSigner).approve(oftAdapter.address, amountLD));
        // send
        await sendOFT(oftAdapter, sendParam, fromSigner);
    } else {
        assert(sourceOftDeploy != null, "No OFT deployed on source chain");
        const oft = await FAssetOFT.attach(sourceOftDeploy.address);
        // send
        await sendOFT(oft, sendParam, fromSigner);
    }
}

async function sendOFT(oft: FAssetOFT | FAssetOFTAdapter, sendParam: SendParamStruct, fromSigner: SignerWithAddress) {
    // Fetch the native fee for the token send operation
    const { nativeFee, lzTokenFee } = await oft.quoteSend(sendParam, false);
    // Execute the send operation from fAssetOFTAdapter contract
    const res = await waitForConfirmations(oft.connect(fromSigner).send(sendParam, { nativeFee, lzTokenFee }, fromSigner.address, { value: nativeFee }));
    // Get summary
    const [sent] = filterLogs(res, oft, "OFTSent");
    assert(sent != null, "Missing OFTSent event");
    console.log(formatEvent(sent));
    console.log(`Sent ${sent.args.amountSentLD}, received ${sent.args.amountReceivedLD}`);
    console.log(`Check transaction: https://testnet.layerzeroscan.com/tx/${res.transactionHash}`);
}
