import { HardhatRuntimeEnvironment } from "hardhat/types";

// Example function to interact with the Flare Network using Tenderly
export async function testProvider(hre: HardhatRuntimeEnvironment) {
  const web3 = hre.web3;

  const contractAddress = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

  const abi = [
    {
      inputs: [
        {
          internalType: "address",
          name: "_addressUpdater",
          type: "address",
        },
      ],
      stateMutability: "nonpayable",
      type: "constructor",
    },
    {
      inputs: [],
      name: "getAddressUpdater",
      outputs: [
        {
          internalType: "address",
          name: "_addressUpdater",
          type: "address",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "getAllContracts",
      outputs: [
        {
          internalType: "string[]",
          name: "",
          type: "string[]",
        },
        {
          internalType: "address[]",
          name: "",
          type: "address[]",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "bytes32",
          name: "_nameHash",
          type: "bytes32",
        },
      ],
      name: "getContractAddressByHash",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "string",
          name: "_name",
          type: "string",
        },
      ],
      name: "getContractAddressByName",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "bytes32[]",
          name: "_nameHashes",
          type: "bytes32[]",
        },
      ],
      name: "getContractAddressesByHash",
      outputs: [
        {
          internalType: "address[]",
          name: "",
          type: "address[]",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "string[]",
          name: "_names",
          type: "string[]",
        },
      ],
      name: "getContractAddressesByName",
      outputs: [
        {
          internalType: "address[]",
          name: "",
          type: "address[]",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "bytes32[]",
          name: "_contractNameHashes",
          type: "bytes32[]",
        },
        {
          internalType: "address[]",
          name: "_contractAddresses",
          type: "address[]",
        },
      ],
      name: "updateContractAddresses",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ];

  // Create a contract instance
  const contract = new web3.eth.Contract(abi, contractAddress);

  try {
    // Call the `getAllContracts` function
    const contracts = await contract.methods.getAllContracts().call();

    console.log("Contracts:", contracts);
  } catch (error) {
    console.error("Error calling contract:", error);
  }
}
