// Run with: yarn hardhat run scripts/fassets/sparkdex.ts --network flare

import { createPublicClient, http, encodeAbiParameters, Address, createWalletClient, custom, WalletClient, PublicClient } from 'viem';
import { flare } from 'viem/chains';
import hre from 'hardhat';
import { qyroLabRouterAbi } from './qyroLabRouterAbi';
import 'dotenv/config';

const NetworkConfig = {
  "14": {
    openocean: {
      router: "0x6352a56caadC4F1E25CD6c75970Fa768A3304e64",
      referAddr: "0x0d09ff7630588E05E2449aBD3dDD1D8d146bc5c2"
    }
  }
} as const;

const swapParamsTuple = {
  name: 'SwapParams',
  type: 'tuple',
  components: [
    { name: 'tokenIn', type: 'address' },
    { name: 'tokenOut', type: 'address' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'amountOutMin', type: 'uint256' },
    { name: 'router', type: 'address' },
    { name: 'callData', type: 'bytes' },
    { name: 'permit2', type: 'address' }
  ]
} as const;

const routerParamsTuple = {
  name: 'RouterParams',
  type: 'tuple',
  components: [
    { name: 'contractAddress', type: 'address' },
    { name: 'srcChainId', type: 'uint256' },
    { name: 'contractVersion', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
    { name: 'user', type: 'address' },
    { name: 'swapParams', type: 'bytes' },
    { name: 'bridgeParams', type: 'bytes' },
    { name: 'fAssetRedeemParams', type: 'bytes' }
  ]
} as const;

interface SwapDataParams {
  publicClient: any;
  account: string;
  fromToken: string;
  toToken: string;
  amount: string;
  srcChain: string;
}

async function getBlockExpiry(publicClient: any) {
  return (await publicClient.getBlock({ blockTag: 'latest' })).timestamp + 60n;
}

async function signMessageData({
  signer,
  walletClient,
  message
}: {
  signer: string;
  walletClient: WalletClient;
  message: `0x${string}`;
}) {
  try {
    const signature = await walletClient.signMessage({
      account: signer as Address,
      message: { raw: message },
    });
    
    // console.log("signature", signature);
    // console.log("signature length", signature.length);
    const signedComposeMessageData = signature + message.replace("0x", "");
    
    console.log("Message signed successfully");
    console.log("Signature length:", signature.length);
    
    return signedComposeMessageData;
  } catch (error) {
    console.error("Error signing message:", error);
    throw new Error(`Failed to sign message: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getOOSwapData({
  publicClient,
  account,
  fromToken,
  toToken,
  amount,
  srcChain
}: {
  publicClient: PublicClient;
  account: Address;
  fromToken: Address;
  toToken: Address;
  amount: string;
  srcChain: string;
}) {
  const router = "0x6352a56caadC4F1E25CD6c75970Fa768A3304e64"
  const params = new URLSearchParams({
    inTokenAddress: fromToken,
    outTokenAddress: toToken,
    amountDecimals: "1000000",
    gasPriceDecimals: "100000000000",
    disabledDexIds: "",
    slippage: '0.3',
    // slippage: "1",
    account: "0x0d09ff7630588E05E2449aBD3dDD1D8d146bc5c2",
    flags: "0",
  });
  
  const url = `https://open-api.openocean.finance/v4/${publicClient.chain?.id}/swap?` + params.toString();

  // console.log(url);
  const res = await fetch(url, {
    headers: {
      'apikey': process.env.OPENOCEAN_API_KEY
    }
  });
  const result = await res.json();
  console.log(result);

  if (result && result.data) {
    const { estimatedGas, data, gasPrice, inAmount, outAmount, minOutAmount } = result.data;
    console.log("estimatedGas", estimatedGas);
    // console.log("data", data);
    console.log("gasPrice", gasPrice);
    console.log("inAmount", inAmount);
    console.log("outAmount", outAmount);
    console.log("minOutAmount", minOutAmount);

    return { 
      estimatedGas, 
      gasPrice, 
      to: router as Address, 
      callData: data, 
      value: 0n, 
      inAmount, 
      outAmount, 
      minOutAmount: BigInt(minOutAmount) 
    };
  }
  return null;
}

async function main() {
  // Create public client for Flare network
  const publicClient = createPublicClient({
    chain: flare,
    transport: http()
  });

  // Get the deployer (invoker of the script)
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deployer address:", await deployer.getAddress());
  
  // Create wallet client using the deployer's signer
  const walletClient = createWalletClient({
    chain: flare,
    transport: custom({
      request: async ({ method, params }) => {
        // Use the deployer's provider for wallet operations
        return await deployer.provider.send(method, params);
      }
    }),
    account: await deployer.getAddress() as Address
  });

  const qyroLabRouterAddress = "0x3c478DDDe165a333F2346Dc0F00Ff5A1a7B19B72";
  
  // Get the nonce from the contract
  const userNonce = (await publicClient.readContract({
    address: qyroLabRouterAddress as Address,
    abi: qyroLabRouterAbi,
    functionName: 'nonces',
    args: [await deployer.getAddress() as Address],
    authorizationList: []
  })) as bigint;
  
  console.log("User nonce:", userNonce.toString());
  
  const swapData = await getOOSwapData({
    publicClient: publicClient as PublicClient,
    account: qyroLabRouterAddress as Address,
    fromToken: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D" as Address,
    toToken: "0xAd552A648C74D49E10027AB8a618A3ad4901c5bE" as Address,
    amount: "1.000000",
    srcChain: "14"
  });
  
  if (!swapData) {
    throw new Error("Failed to get swap data from OpenOcean");
  }
  
  const { estimatedGas, callData: data, inAmount, minOutAmount } = swapData;

  console.log("Estimated gas:", estimatedGas);
  // console.log("Call data:", data);
  console.log("In amount:", inAmount);
  console.log("Min out amount:", minOutAmount);

  const swapParamsData = encodeAbiParameters(
    [swapParamsTuple],
    [{
        tokenIn: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
        tokenOut: "0xAd552A648C74D49E10027AB8a618A3ad4901c5bE",
        amountIn: BigInt(inAmount),
        amountOutMin: BigInt(minOutAmount),
        router: "0x6352a56caadC4F1E25CD6c75970Fa768A3304e64",
        callData: data,
        permit2: "0x0000000000000000000000000000000000000000"
    }]
  );

  const routerParamsData = encodeAbiParameters(
    [routerParamsTuple],
    [{
        contractAddress: qyroLabRouterAddress as Address,
        srcChainId: BigInt(14),
        contractVersion: BigInt(1),
        nonce: userNonce,
        expiry: await getBlockExpiry(publicClient),
        user: await deployer.getAddress() as Address,
        swapParams: swapParamsData,
        bridgeParams: "0x",
        fAssetRedeemParams: "0x"
    }]
  );

  // console.log("Router params data:", routerParamsData);

  const signedRouterParamsData = await signMessageData({
    signer: await deployer.getAddress(),
    walletClient: walletClient,
    message: routerParamsData
  });
  
  // console.log("Signed router params data:", signedRouterParamsData);

  console.log("Contract call preparation complete");
  console.log("Signed data ready for contract interaction");
  
  try {
    console.log("Attempting contract simulation...");
    console.log("Using routerSwapAndBridge function with signed data");
    
    const { request } = await publicClient.simulateContract({
      account: walletClient.account.address,
      address: qyroLabRouterAddress,
      abi: qyroLabRouterAbi,
      functionName: 'routerSwapAndBridge',
      args: [
        signedRouterParamsData as `0x${string}`
      ],
    });
    
    console.log("Contract simulation successful");
    const tx = await walletClient.writeContract(request);
    console.log("swapTx:", tx);
    
  } catch (error) {
    console.error("Contract simulation/execution failed:", error);
  }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
