

// type of our contract
import { FlareContractRegistryMockInstance, PriceAnalyticsContract, PriceAnalyticsInstance } from '../typechain-types';
import { MockContractInstance } from '../typechain-types/@gnosis.pm/mock-contract/contracts/MockContract.sol/MockContract';

const MockContract = artifacts.require("MockContract");
const PriceAnalytics: PriceAnalyticsContract = artifacts.require("PriceAnalytics");


import { abi as abiFtso } from "../artifacts/@flarenetwork/flare-periphery-contracts/coston2/ftso/userInterfaces/IFtso.sol/IFtso.json";
import { abi as abiRegistry } from "../artifacts/@flarenetwork/flare-periphery-contracts/coston2/ftso/userInterfaces/IFtsoRegistry.sol/IFtsoRegistry.json";
import { deployFlareContractRegistry, getTime } from '../lib/utils';

const IFtsoRegistry = new web3.eth.Contract(
    abiRegistry as any
)

const IFtso = new web3.eth.Contract(
    abiFtso as any
)



describe('PriceAnalytics', async () => {
    let flareContractRegistry: FlareContractRegistryMockInstance;
    let ftsoRegistryMock: MockContractInstance;
    let ftsoMock: MockContractInstance;

    let priceAnalytics: PriceAnalyticsInstance

    beforeEach(async () => {
        flareContractRegistry = await deployFlareContractRegistry(true);
        ftsoRegistryMock = await MockContract.new();

        await flareContractRegistry.update(
            ["FtsoRegistry"],
            [ftsoRegistryMock.address]
        )

        ftsoMock = await MockContract.new();

        const methodGetFtso = IFtsoRegistry.methods["getFtsoBySymbol"](
            "BTC"
        ).encodeABI();
        await ftsoRegistryMock.givenCalldataReturn(
            methodGetFtso,
            web3.eth.abi.encodeParameters(
                ["address"],
                [ftsoMock.address]
            )
        );

        const methodsGetPriceEpochConfiguration = IFtso.methods["getPriceEpochConfiguration"](
        ).encodeABI();
        await ftsoMock.givenCalldataReturn(
            methodsGetPriceEpochConfiguration,
            web3.eth.abi.encodeParameters(
                ["uint256", "uint256", "uint256"],
                [1662554790, 180, 90]
            )
        );

        const timestamp = await getTime();
        const currentEpoch = Math.floor((timestamp - 1662554790) / 180);
        for (let i = 0; i < 10; i++) {
            const methodGetEpochPrice = IFtso.methods["getEpochPrice"](
                currentEpoch - i
            ).encodeABI();
            await ftsoMock.givenCalldataReturn(
                methodGetEpochPrice,
                web3.eth.abi.encodeParameters(
                    ["uint256",],
                    [2 ** i]
                )
            );
        }

        priceAnalytics = await PriceAnalytics.new()


    })

    it("Should work", async () => {
        const tx = await priceAnalytics.getLast5Prices("BTC")
        console.log(tx["0"].map((x: any) => x.toString()))
        console.log(tx["1"].toString())
        console.log(tx["2"].toString())
    })

})