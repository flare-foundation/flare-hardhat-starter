// Add this at the very top, before other imports
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract, ContractFactory, utils } from "ethers";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { deployments, ethers } from "hardhat";

describe("MyOApp Test", function () {
    // Constant representing a mock Endpoint ID for testing purposes
    const eidA = 1;
    const eidB = 2;
    // Declaration of variables to be used in the test suite
    let MyOApp: ContractFactory;
    let EndpointV2Mock: ContractFactory;
    let ownerA: SignerWithAddress;
    let ownerB: SignerWithAddress;
    let endpointOwner: SignerWithAddress;
    let myOAppA: Contract;
    let myOAppB: Contract;
    let mockEndpointV2A: Contract;
    let mockEndpointV2B: Contract;

    // Before hook for setup that runs once before all tests in the block
    before(async function () {
        // Contract factory for our tested contract
        MyOApp = await ethers.getContractFactory("MyOApp");

        // Fetching the first three signers (accounts) from Hardhat's local Ethereum network
        const signers = await ethers.getSigners();

        [ownerA, ownerB, endpointOwner] = signers;

        // The EndpointV2Mock contract comes from @layerzerolabs/test-devtools-evm-hardhat package
        // and its artifacts are connected as external artifacts to this project
        //
        // Unfortunately, hardhat itself does not yet provide a way of connecting external artifacts,
        // so we rely on hardhat-deploy to create a ContractFactory for EndpointV2Mock
        //
        // See https://github.com/NomicFoundation/hardhat/issues/1040
        const EndpointV2MockArtifact = await deployments.getArtifact("EndpointV2Mock");
        EndpointV2Mock = new ContractFactory(
            EndpointV2MockArtifact.abi,
            EndpointV2MockArtifact.bytecode,
            endpointOwner
        );
    });

    // beforeEach hook for setup that runs before each test in the block
    beforeEach(async function () {
        // Deploying a mock LZ EndpointV2 with the given Endpoint ID
        mockEndpointV2A = await EndpointV2Mock.deploy(eidA);
        await mockEndpointV2A.deployed();
        mockEndpointV2B = await EndpointV2Mock.deploy(eidB);
        await mockEndpointV2B.deployed();

        // Deploying two instances of MyOApp contract and linking them to the mock LZEndpoint
        const myOAppFactoryA = MyOApp.connect(ownerA);
        myOAppA = await myOAppFactoryA.deploy(mockEndpointV2A.address, ownerA.address);
        await myOAppA.deployed();
        const myOAppFactoryB = MyOApp.connect(ownerB);
        myOAppB = await myOAppFactoryB.deploy(mockEndpointV2B.address, ownerB.address);
        await myOAppB.deployed();

        // Setting destination endpoints in the LZEndpoint mock for each MyOApp instance
        await mockEndpointV2A.connect(endpointOwner).setDestLzEndpoint(myOAppB.address, mockEndpointV2B.address);
        await mockEndpointV2B.connect(endpointOwner).setDestLzEndpoint(myOAppA.address, mockEndpointV2A.address);

        // Setting each MyOApp instance as a peer of the other
        await myOAppA.connect(ownerA).setPeer(eidB, ethers.utils.zeroPad(myOAppB.address, 32));
        await myOAppB.connect(ownerB).setPeer(eidA, ethers.utils.zeroPad(myOAppA.address, 32));
    });

    it("deploys contracts with valid addresses", async function () {
      expect(utils.isAddress(myOAppA.address)).to.be.true;
      expect(utils.isAddress(myOAppB.address)).to.be.true;
      expect(utils.isAddress(mockEndpointV2A.address)).to.be.true;
      expect(utils.isAddress(mockEndpointV2B.address)).to.be.true;
    });
    
    it("quote() returns a fee struct without reverting", async function () {
        const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex();
        const fee = await myOAppA.callStatic.quote(eidB, "Hello", options);
        // fee is a MessagingFee struct
        expect(fee).to.have.property("nativeFee");
        expect(fee).to.have.property("lzTokenFee");
    });
});