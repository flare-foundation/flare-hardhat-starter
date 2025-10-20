// yarn hardhat run scripts/fassets/sparkdex-swap.ts --network flare

import { ethers } from "hardhat";


const USE_EXACT_INPUT_SINGLE = true; // Set to false to use exactInput instead

async function main() {

  const signer = (await ethers.getSigners())[0];
  
  // Get current block timestamp from blockchain
  const currentBlock = await signer.provider.getBlock('latest');
  const blockchainTimestamp = currentBlock?.timestamp || 0;

  // Uniswap V3-compatible SwapRouter on Flare
  const SWAP_ROUTER = "0x8a1E35F5c98C4E85B36B7B253222eE17773b2781";

  // USDT0 and FXRP
  const USDT0 = "0xe7cd86e13AC4309349F30B3435a9d337750fC82D";
  const FXRP  = "0xAd552A648C74D49E10027AB8a618A3ad4901c5bE";

  // Pool fee tier
  const FEE = 500; // 0.05%

  // Swap parameters
  const amountIn = ethers.parseUnits("1.0", 6); // 1 USDT0
  const amountOutMin = ethers.parseUnits("0.3", 6); // 0.3 FXRP minimum expected
  const deadline = blockchainTimestamp + 60 * 20; // 20 minutes from blockchain time

  const recipient = signer.address;

  console.log("Swap parameters:");
  console.log("- Token In:", USDT0);
  console.log("- Token Out:", FXRP);
  console.log("- Amount In:", amountIn.toString());
  console.log("- Amount Out Min:", amountOutMin.toString());
  console.log("- Fee:", FEE);
  console.log("- Recipient:", recipient);
  console.log("- Deadline:", deadline);

  // Router ABI fragment for exactInputSingle and pool functions
  const routerAbi = [
    `function exactInputSingle((
    address tokenIn,
    address tokenOut,
    uint24 fee,
    address recipient,
    uint256 deadline,
    uint256 amountIn,
    uint256 amountOutMinimum,
    uint160 sqrtPriceLimitX96
  )) external payable returns (uint256)`,
    `function exactInput((
    bytes path,
    address recipient,
    uint256 deadline,
    uint256 amountIn,
    uint256 amountOutMinimum
  )) external payable returns (uint256)`,
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)",
    "function factory() external view returns (address)",
    "function multicall(bytes[] calldata data) external payable returns (bytes[] memory results)"
  ];

  const router = new ethers.Contract(SWAP_ROUTER, routerAbi, signer);
  
  try {
    const factory = await router.factory();
    console.log("Factory address:", factory);
  } catch (error) {
    console.log("❌ Error getting factory:", error);
  }
  
  // Check if the pool exists using multiple methods
  console.log("\n=== Checking Pool Existence ===");

  // Try to get pool address from factory
  try {
    const factoryAddress = await router.factory();
    console.log("Factory address:", factoryAddress);
    
    // Create factory contract to check pool
    const factoryAbi = [
      "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
    ];
    const factory = new ethers.Contract(factoryAddress, factoryAbi, signer);
    
    const poolAddress = await factory.getPool(USDT0, FXRP, FEE);
    console.log("Pool address from factory:", poolAddress);
    
    if (poolAddress === "0x0000000000000000000000000000000000000000") {
      console.log("❌ Pool does not exist for this token pair and fee tier");
      return;
    } else {
      console.log("✅ Pool exists at address:", poolAddress);
    }
  } catch (error) {
    console.log("❌ Error getting pool from factory:", error.message);
  }

  // Check if pool contract exists and has liquidity
  try {
    const factoryAddress = await router.factory();
    const factoryAbi = [
      "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
    ];
    const factory = new ethers.Contract(factoryAddress, factoryAbi, signer);
    const poolAddress = await factory.getPool(USDT0, FXRP, FEE);
    
    if (poolAddress !== "0x0000000000000000000000000000000000000000") {
      // Check if pool has liquidity
      const poolAbi = [
        "function liquidity() external view returns (uint128)",
        "function token0() external view returns (address)",
        "function token1() external view returns (address)",
        "function fee() external view returns (uint24)"
      ];
      const pool = new ethers.Contract(poolAddress, poolAbi, signer);
      
      const liquidity = await pool.liquidity();
      const token0 = await pool.token0();
      const token1 = await pool.token1();
      const fee = await pool.fee();
      
      console.log("Pool details:");
      console.log("- Token0:", token0);
      console.log("- Token1:", token1);
      console.log("- Fee:", fee.toString());
      console.log("- Liquidity:", liquidity.toString());
      
      if (liquidity === 0) {
        console.log("❌ Pool exists but has no liquidity");
        return;
      } else {
        console.log("✅ Pool exists and has liquidity");
      }
    }
  } catch (error) {
    console.log("❌ Error checking pool details:", error.message);
  }

  // Approve USDT0 to router
  const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)"
  ];
  const usdt0 = new ethers.Contract(USDT0, erc20Abi, signer);
  const approveTx = await usdt0.approve(SWAP_ROUTER, amountIn);
  await approveTx.wait();
  console.log("✅ USDT0 approved");

  try {
    if (USE_EXACT_INPUT_SINGLE) {
      // Use exactInputSingle method
      console.log("Using exactInputSingle method (configured)...");
      console.log("Simulation parameters:");
      console.log("- tokenIn:", USDT0);
      console.log("- tokenOut:", FXRP);
      console.log("- fee:", FEE);
      console.log("- recipient:", recipient);
      console.log("- deadline:", deadline);
      console.log("- amountIn:", amountIn.toString());
      console.log("- amountOutMinimum:", amountOutMin.toString());
      console.log("- sqrtPriceLimitX96:", 0);
      
      await router.exactInputSingle.staticCall({
        tokenIn: USDT0,
        tokenOut: FXRP,
        fee: FEE,
        recipient: recipient,
        deadline: deadline,
        amountIn: amountIn,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0
      });
      console.log("✅ exactInputSingle simulation successful");
      
      // Execute exactInputSingle transaction
      console.log("Executing exactInputSingle transaction...");
      const swapTx = await router.exactInputSingle({
        tokenIn: USDT0,
        tokenOut: FXRP,
        fee: FEE,
        recipient: recipient,
        deadline: deadline,
        amountIn: amountIn,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0
      }, {
        gasLimit: 1_500_000
      });
      
      console.log("Transaction submitted:", swapTx.hash);
      console.log("Waiting for confirmation...");
      
      const receipt = await swapTx.wait();
      console.log("✅ Swap executed successfully!");
      console.log("Transaction hash:", receipt.transactionHash);
      console.log(receipt);
      console.log("Block number:", receipt.blockNumber);
      console.log("Gas used:", receipt.gasUsed.toString());
      console.log("Status:", receipt.status === 1 ? "Success" : "Failed");
      
    } else {
      // Use exactInput method
      console.log("Using exactInput method (configured)...");
      
      // Create path for exactInput (token0 + fee + token1)
      const path = ethers.solidityPacked(
        ["address", "uint24", "address"],
        [USDT0, FEE, FXRP]
      );
      console.log("Path for exactInput:", path);
      
      console.log("Simulation parameters:");
      console.log("- path:", path);
      console.log("- recipient:", recipient);
      console.log("- deadline:", deadline);
      console.log("- amountIn:", amountIn.toString());
      console.log("- amountOutMinimum:", amountOutMin.toString());
      
      await router.exactInput.staticCall({
        path: path,
        recipient: recipient,
        deadline: deadline,
        amountIn: amountIn,
        amountOutMinimum: amountOutMin
      });
      console.log("✅ exactInput simulation successful");

      // Execute exactInput transaction
      console.log("Executing exactInput transaction...");
      const swapTx = await router.exactInput({
        path: path,
        recipient: recipient,
        deadline: deadline,
        amountIn: amountIn,
        amountOutMinimum: amountOutMin
      }, {
        gasLimit: 1_500_000
      });
      
      console.log("Transaction submitted:", swapTx.hash);
      console.log("Waiting for confirmation...");
      
      const receipt = await swapTx.wait();
      console.log("✅ Swap executed successfully!");
      console.log("receipt:", receipt);
      console.log("Transaction hash:", receipt.transactionHash);
      console.log("Block number:", receipt.blockNumber);
      console.log("Gas used:", receipt.gasUsed.toString());
      console.log("Status:", receipt.status === 1 ? "Success" : "Failed");
    }
    
  } catch (error) {
    console.error("❌ Swap failed:", error);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
