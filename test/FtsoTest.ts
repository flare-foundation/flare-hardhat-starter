

// type of our contract
import { FlareContractRegistryMockInstance, SimpleFtsoExampleContract, SimpleFtsoExampleInstance } from '../typechain-types';
import { MockContractInstance } from '../typechain-types/@gnosis.pm/mock-contract/contracts/MockContract.sol/MockContract';

const MockContract = artifacts.require("MockContract");
const SimpleFtsoExample: SimpleFtsoExampleContract = artifacts.require('SimpleFtsoExample');


import { abi as abiRegistry } from "../artifacts/@flarenetwork/flare-periphery-contracts/coston2/ftso/userInterfaces/IFtsoRegistry.sol/IFtsoRegistry.json";
import { deployFlareContractRegistry } from '../lib/utils';

const IFtsoRegistry = new web3.eth.Contract(
    abiRegistry as any
)

describe('ReadPrice', async () => {
    let flareContractRegistry: FlareContractRegistryMockInstance;

    let ftsoRegistryMock: MockContractInstance;

    beforeEach(async () => {
        flareContractRegistry = await deployFlareContractRegistry(true);
        ftsoRegistryMock = await MockContract.new();

        await flareContractRegistry.update(
            ["FtsoRegistry"],
            [ftsoRegistryMock.address]
        )
    })

    it("Should mock token price", async () => {
        const ftsoExample: SimpleFtsoExampleInstance = await SimpleFtsoExample.new();

        const methodGetPrice = IFtsoRegistry.methods["getCurrentPriceWithDecimals(string)"](
            "BTC"
        ).encodeABI();
        await ftsoRegistryMock.givenCalldataReturn(
            methodGetPrice,
            web3.eth.abi.encodeParameters(
                ["uint256", "uint256", "uint256"],
                [1234567890123, 0, 5]
            )
        );

        const priceInfo = await ftsoExample.getCurrentTokenPriceWithDecimals("BTC")
        // console.log(priceInfo[0].toString());
        // console.log(priceInfo[2].toString());

        const weiPriceInfo = await ftsoExample.getTokenPriceInUSDWei("BTC")
        // console.log(weiPriceInfo[0].toString())

    })

    it("Should calculate ratio", async () => {
        const ftsoExample: SimpleFtsoExampleInstance = await SimpleFtsoExample.new();
        await ftsoRegistryMock.givenCalldataReturn(
            IFtsoRegistry.methods["getCurrentPriceWithDecimals(string)"](
                "BTC"
            ).encodeABI(),
            web3.eth.abi.encodeParameters(
                ["uint256", "uint256", "uint256"],
                [10, 0, 5]
            )
        );

        await ftsoRegistryMock.givenCalldataReturn(
            IFtsoRegistry.methods["getCurrentPriceWithDecimals(string)"](
                "LTC"
            ).encodeABI(),
            web3.eth.abi.encodeParameters(
                ["uint256", "uint256", "uint256"],
                [200, 0, 6]
            )
        );

        const priceInfo = await ftsoExample.getCurrentTokenPriceWithDecimals("BTC")
        const weiPriceInfo = await ftsoExample.getTokenPriceInUSDWei("LTC")

        const ratio = await ftsoExample.isPriceRatioHigherThan("BTC", "LTC", 999, 2000)

        console.log(
            ratio[0].toString(),
            ratio[1].toString(),
            ratio[2].toString(),
        )

    })

})