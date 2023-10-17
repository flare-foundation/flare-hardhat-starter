

// type of our contract
import { CoinFutureContract, CoinFutureInstance, FlareContractRegistryMockInstance, SimpleFtsoExampleContract } from '../typechain-types';
import { MockContractInstance } from '../typechain-types/@gnosis.pm/mock-contract/contracts/MockContract.sol/MockContract';

const MockContract = artifacts.require("MockContract");
const SimpleFtsoExample: SimpleFtsoExampleContract = artifacts.require('SimpleFtsoExample');
const CoinFuture: CoinFutureContract = artifacts.require('CoinFuture');

import { ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { abi as abiRegistry } from "../artifacts/@flarenetwork/flare-periphery-contracts/coston2/ftso/userInterfaces/IFtsoRegistry.sol/IFtsoRegistry.json";
import { deployFlareContractRegistry, getTime, increaseTimeTo, toBN } from '../lib/utils';

const IFtsoRegistry = new web3.eth.Contract(
    abiRegistry as any
)

describe('Future', async () => {
    let flareContractRegistry: FlareContractRegistryMockInstance;

    let ftsoRegistryMock: MockContractInstance;
    let coinFuture: CoinFutureInstance;
    beforeEach(async () => {
        flareContractRegistry = await deployFlareContractRegistry(true);
        ftsoRegistryMock = await MockContract.new();

        await flareContractRegistry.update(
            ["FtsoRegistry"],
            [ftsoRegistryMock.address]
        )

        coinFuture = await CoinFuture.new()
    })

    it("Should work in a simple way", async () => {
        const [signer1, signer2] = await ethers.getSigners();

        const currentTime = await getTime();
        const targetPrice = toBN(12345).mul(toBN(10).pow(toBN(18)))
        const tx = coinFuture.proposeFuture(currentTime + 10 * 24 * 60 * 60, "BTC", targetPrice, 3, { value: 1000 })

        expect(tx).to.emit(coinFuture, "FutureProposed").withArgs(
            signer1.address,
            ZeroAddress,
            currentTime + 10 * 24 * 60 * 60,
            "BTC",
            targetPrice,
            3,
            1000
        )

        // accept the proposal

        await tx;
        const payout = await coinFuture.calculateFuturePayout(0);

        const tx2 = await coinFuture.acceptFuture(0, { value: payout.subn(1000), from: signer2.address })

        // Execute it
        increaseTimeTo(currentTime + 10 * 24 * 60 * 60 + 1)

        // This is exactly the same price, so the winner should be the proposer
        const methodGetPrice = IFtsoRegistry.methods["getCurrentPriceWithDecimals(string)"](
            "BTC"
        ).encodeABI();
        await ftsoRegistryMock.givenCalldataReturn(
            methodGetPrice,
            web3.eth.abi.encodeParameters(
                ["uint256", "uint256", "uint256"],
                [targetPrice.div(toBN(10).pow(toBN(5))), 0, 5]
            )
        );

        const tx3 = coinFuture.settleFuture(0)
        expect(tx3).to.emit(coinFuture, "FutureSettled").withArgs(
            0, signer1.address, payout
        )

        await tx3;

    })


})