

import Beatblock from './Beatblock.json';

import { abi } from './Beatblock.json';  // Import ABI from the compiled contract JSON


// export const provider = new ethers.providers.Web3Provider(window.ethereum);
import detectEthereumProvider from '@metamask/detect-provider';

// const provider = new ethers.providers.Web3Provider(window.ethereum);
// const signer = provider.getSigner();

import { ethers } from "ethers";


export const provider = new ethers.providers.Web3Provider(window.ethereum);
const contractAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3";


export const contract = new ethers.Contract(
  contractAddress,
  Beatblock.abi,
  provider.getSigner()
);
