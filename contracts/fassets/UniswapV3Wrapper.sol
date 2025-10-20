// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
    function factory() external view returns (address);
}

interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

interface IUniswapV3Pool {
    function liquidity() external view returns (uint128);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
}

contract UniswapV3Wrapper {
    using SafeERC20 for IERC20;
    
    // Existing Uniswap V3 SwapRouter on Flare
    ISwapRouter public immutable swapRouter;
    IUniswapV3Factory public immutable factory;
    
    // Events
    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 deadline,
        string method
    );
    
    event PoolChecked(
        address indexed tokenA,
        address indexed tokenB,
        uint24 fee,
        address poolAddress,
        uint128 liquidity
    );

    event TokensApproved(address indexed token, address indexed spender, uint256 amount);

    constructor(address _swapRouter) {
        swapRouter = ISwapRouter(_swapRouter);
        factory = IUniswapV3Factory(ISwapRouter(_swapRouter).factory());
    }

    function checkPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external view returns (
        address poolAddress,
        bool hasLiquidity,
        uint128 liquidity
    ) {
        poolAddress = factory.getPool(tokenA, tokenB, fee);
        
        if (poolAddress != address(0)) {
            IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
            liquidity = pool.liquidity();
            hasLiquidity = liquidity > 0;
        }
    }

    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint256 deadline,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 amountOut) {
        // Check if pool exists
        address poolAddress = factory.getPool(tokenIn, tokenOut, fee);
        require(poolAddress != address(0), "Pool does not exist");
        
        // Check if pool has liquidity
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        require(pool.liquidity() > 0, "Pool has no liquidity");
        
        // Transfer tokens from user to this contract
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Approve router to spend tokens using SafeERC20
        IERC20(tokenIn).approve(address(swapRouter), amountIn);
        emit TokensApproved(tokenIn, address(swapRouter), amountIn);
        
        // Prepare swap parameters
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: msg.sender,
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: sqrtPriceLimitX96
        });
        
        // Execute swap
        amountOut = swapRouter.exactInputSingle(params);
        
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, deadline, "exactInputSingle");
    }

    function swapExactInput(
        bytes calldata path,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint256 deadline
    ) external returns (uint256 amountOut) {
        // Extract token addresses from path
        address tokenIn = address(bytes20(path[0:20]));
        
        // Transfer tokens from user to this contract
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Approve router to spend tokens using SafeERC20
        IERC20(tokenIn).approve(address(swapRouter), amountIn);
        emit TokensApproved(tokenIn, address(swapRouter), amountIn);
        
        // Prepare swap parameters
        ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
            path: path,
            recipient: msg.sender,
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum
        });
        
        // Execute swap
        amountOut = swapRouter.exactInput(params);
        
        // Extract output token from path (last 20 bytes)
        address tokenOut = address(bytes20(path[path.length-20:path.length]));
        
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, deadline, "exactInput");
    }
}
