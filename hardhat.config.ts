import '@nomicfoundation/hardhat-chai-matchers';
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import '@nomiclabs/hardhat-truffle5';
import '@typechain/hardhat';
import "dotenv/config";
import { HardhatUserConfig, task } from "hardhat/config";
const intercept = require('intercept-stdout');
const { GOERLI_API_URL, PRIVATE_KEY, ETHERSCAN_API_URL, ANKR_SEPOLIA_API_KEY, FLARESCAN_API_KEY, FLARE_EXPLORER_API_KEY, FLARE_RPC_API_KEY } = process.env;

const USE_FLARESCAN = false;

import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';

// Override solc compile task and filter out useless warnings
task(TASK_COMPILE)
  .setAction(async (args, hre, runSuper) => {
    intercept((text: any) => {
      if (/MockContract.sol/.test(text) && text.match(/Warning: SPDX license identifier not provided in source file/)) return '';
      if (/MockContract.sol/.test(text) &&
        /Warning: This contract has a payable fallback function, but no receive ether function/.test(text)) return '';
      return text;
    });
    await runSuper(args);
  });


const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          evmVersion: "london",
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      }
    ],
    overrides: {
      "contracts/Imports060.sol": {
        version: "0.6.6",
        settings: {
        }
      },
      "@gnosis.pm/mock-contract/contracts/MockContract.sol": {
        version: "0.6.6",
        settings: {
        }
      },
    }
  },
  networks: {
    goerli: {
      url: `https://eth-goerli.alchemyapi.io/v2/${GOERLI_API_URL}`,
      accounts: [`${PRIVATE_KEY}`]
    },
    sepolia: {
      url: `https://rpc.ankr.com/eth_sepolia/${ANKR_SEPOLIA_API_KEY}`,
      accounts: [`${PRIVATE_KEY}`]
    },
    coston: {
      url: "https://coston-api.flare.network/ext/bc/C/rpc" + (FLARE_RPC_API_KEY ? `?x-apikey=${FLARE_RPC_API_KEY}` : ""),
      accounts: [`${PRIVATE_KEY}`],
      chainId: 16
    },
    coston2: {
      url: "https://coston2-api.flare.network/ext/C/rpc" + (FLARE_RPC_API_KEY ? `?x-apikey=${FLARE_RPC_API_KEY}` : ""),
      accounts: [`${PRIVATE_KEY}`],
      chainId: 114
    },
    songbird: {
      url: "https://songbird-api.flare.network/ext/bc/C/rpc" + (FLARE_RPC_API_KEY ? `?x-apikey=${FLARE_RPC_API_KEY}` : ""),
      accounts: [`${PRIVATE_KEY}`],
      chainId: 19
    },
    flare: {
      url: "https://flare-api.flare.network/ext/C/rpc" + (FLARE_RPC_API_KEY ? `?x-apikey=${FLARE_RPC_API_KEY}` : ""),
      accounts: [`${PRIVATE_KEY}`],
      chainId: 14,
    }
  },
  etherscan: {
    apiKey: {
      "goerli": `${ETHERSCAN_API_URL}`,
      "coston": `${FLARESCAN_API_KEY}`,
      "coston2": `${FLARESCAN_API_KEY}`,
      "songbird": `${FLARESCAN_API_KEY}`,
      "flare": `${FLARESCAN_API_KEY}`,
      "sepolia": `${ETHERSCAN_API_URL}`,
    },
    customChains: [
      {
        network: "coston",
        chainId: 16,
        urls: {
          // faucet: https://faucet.towolabs.com/
          apiURL: "https://coston-explorer.flare.network/api" + (FLARE_EXPLORER_API_KEY ? `?x-apikey=${FLARE_EXPLORER_API_KEY}` : ""), // Must not have / endpoint
          browserURL: "https://coston-explorer.flare.network"
        }
      },
      {
        network: "coston2",
        chainId: 114,
        urls: {
          // faucet: https://coston2-faucet.towolabs.com/
          apiURL: "https://coston2-explorer.flare.network/api" + (FLARE_EXPLORER_API_KEY ? `?x-apikey=${FLARE_EXPLORER_API_KEY}` : ""), // Must not have / endpoint
          browserURL: "https://coston2-explorer.flare.network"
        }
      },
      {
        network: "songbird",
        chainId: 19,
        urls: {
          apiURL: "https://songbird-explorer.flare.network/api" + (FLARE_EXPLORER_API_KEY ? `?x-apikey=${FLARE_EXPLORER_API_KEY}` : ""), // Must not have / endpoint
          browserURL: "https://songbird-explorer.flare.network/"
        }
      },
      {
        network: "flare",
        chainId: 14,
        urls: {
          apiURL: "https://flare-explorer.flare.network/api" + (FLARE_EXPLORER_API_KEY ? `?x-apikey=${FLARE_EXPLORER_API_KEY}` : ""), // Must not have / endpoint
          browserURL: "https://flare-explorer.flare.network/",
        }
      }
    ]
  },
  paths: {
    sources: "./contracts/",
    tests: "./test/",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  typechain: {
    target: 'truffle-v5',
  },
};

if (USE_FLARESCAN) {
  const FLARESCAN_DATA = [
    {
      apiURL: "https://api.routescan.io/v2/network/testnet/evm/16/etherscan",
      browserURL: "https://coston.testnet.flarescan.com"
    },
    {
      apiURL: "https://api.routescan.io/v2/network/testnet/evm/114/etherscan",
      browserURL: "https://coston2.testnet.flarescan.com"
    },
    {
      apiURL: "https://api.routescan.io/v2/network/mainnet/evm/19/etherscan",
      browserURL: "https://songbird.flarescan.com"
    },
    {
      apiURL: "https://api.routescan.io/v2/network/mainnet/evm/14/etherscan",
      browserURL: "https://mainnet.flarescan.com"
    }
  ]

  for (let i = 0; i < FLARESCAN_DATA.length; i++) {
    config.etherscan.customChains[i].urls = FLARESCAN_DATA[i]
  }
}

export default config;