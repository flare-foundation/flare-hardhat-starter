import { setNonce } from "@nomicfoundation/hardhat-network-helpers";
import { time } from '@openzeppelin/test-helpers';
import BN from "bn.js";
import hardhat, { ethers } from 'hardhat';
import { FLARE_CONTRACT_REGISTRY_ADDRESS } from '../lib/constants';
import { FlareContractRegistryMockContract, FlareContractRegistryMockInstance } from '../typechain-types';
const FlareContractRegistryMock: FlareContractRegistryMockContract = artifacts.require('FlareContractRegistryMock');


export async function getTime(): Promise<number> {
    await time.advanceBlock();
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block!!.timestamp;
    return timestamp
}

/**
 * Helper wrapper to convert number to BN 
 * @param x number expressed in any reasonable type
 * @returns same number as BN
 */
export function toBN(x: BN | number | string): BN {
    if (x instanceof BN) return x;
    return web3.utils.toBN(x);
}

export async function deployFlareContractRegistry(strict: boolean = true): Promise<FlareContractRegistryMockInstance> {

    try {
        const flareContractRegistryMock = await FlareContractRegistryMock.at(FLARE_CONTRACT_REGISTRY_ADDRESS);
        return flareContractRegistryMock
    } catch (e) {
        // We deploy from specified address instead of setting the code directly so that the state does is kept
        const [signer] = await ethers.getSigners();
        const FLARE_CONTRACT_REGISTRY_DEPLOYER = "0x383A7bD61490EbaC078CB420B326FCE264042d19"
        await setNonce(FLARE_CONTRACT_REGISTRY_ADDRESS, 0);
        await hardhat.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [FLARE_CONTRACT_REGISTRY_DEPLOYER],
        });

        const forgedAccount = await ethers.getSigner(FLARE_CONTRACT_REGISTRY_DEPLOYER);
        signer.sendTransaction({ to: forgedAccount.address, value: ethers.parseEther("1") });
        const flareContractRegistryMock = await FlareContractRegistryMock.new(strict, { from: forgedAccount.address });

        assert(flareContractRegistryMock.address == FLARE_CONTRACT_REGISTRY_ADDRESS, "FlareContractRegistry was not deployed at the correct address");

        await hardhat.network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [FLARE_CONTRACT_REGISTRY_DEPLOYER],
        });
        return flareContractRegistryMock
    }
}

export async function sleep(ms: number) {
    await new Promise<void>(resolve => setTimeout(() => resolve(), ms));
}

/**
 * Sets parameters for shifting time to future. Note: seems like 
 * no block is mined after this call, but the next mined block has
 * the the timestamp equal time + 1 
 * @param tm 
 */
export async function increaseTimeTo(tm: number) {
    await ethers.provider.send("evm_mine", [tm]);

}