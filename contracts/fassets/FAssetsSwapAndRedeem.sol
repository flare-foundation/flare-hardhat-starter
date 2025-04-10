// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@blazeswap/contracts/contracts/periphery/interfaces/IBlazeSwapRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IAssetManager} from "@flarenetwork/flare-periphery-contracts/coston/IAssetManager.sol";
import {AssetManagerSettings} from "@flarenetwork/flare-periphery-contracts/coston/userInterfaces/data/AssetManagerSettings.sol";

contract FSwap {
    IBlazeSwapRouter public immutable router;
    IAssetManager public immutable assetManager;
    IERC20 public immutable token;

    address[] public swapPath;

    event RedemptionNeeded(uint256 amountIn, uint256 amountOut);

    event SwapStarted(uint256 amount, address[] path, uint256 deadline);

    event SwapCompleted(uint256[] amountsSent, uint256[] amountsRecv);

    event Redeemed(uint256 redeemedAmountUBA);

    constructor(
        address _router,
        address _assetManager,
        address[] memory _swapPath
    ) {
        router = IBlazeSwapRouter(_router);
        assetManager = IAssetManager(_assetManager);
        swapPath = _swapPath;

        token = IERC20(_swapPath[0]);
    }

    function calculateRedemptionAmountIn(
        uint256 _lots
    ) public view returns (uint256 amountOut, uint256 amountIn) {
        AssetManagerSettings.Data memory settings = assetManager.getSettings();
        uint256 lotSizeAMG = settings.lotSizeAMG;

        uint256[] memory amounts = router.getAmountsIn(
            lotSizeAMG * _lots,
            swapPath
        );

        return (amounts[0], amounts[1]);
    }

    function swapAndRedeem(
        uint256 _lots,
        string memory _redeemerUnderlyingAddressString
    )
        external
        payable
        returns (
            uint256 amountOut,
            uint256 deadline,
            uint256[] memory amountsSent,
            uint256[] memory amountsRecv,
            uint256 _redeemedAmountUBA
        )
    {
        // Calculate the amount of NAT needed to redeem the assets
        (uint256 _amountIn, uint256 _amountOut) = calculateRedemptionAmountIn(
            _lots
        );

        require(
            token.balanceOf(msg.sender) >= _amountIn,
            "Insufficient token balance"
        );

        require(
            token.allowance(msg.sender, address(this)) >= _amountIn,
            "Insufficient allowance"
        );

        // Transfer tokens from msg.sender to this contract
        require(
            token.transferFrom(msg.sender, address(this), _amountIn),
            "Transfer failed"
        );

        // Approve router to spend the tokens
        require(
            token.approve(address(router), _amountIn),
            "Router approval failed"
        );

        emit RedemptionNeeded(_amountIn, _amountOut);

        // Set the deadline for the swap
        uint256 _deadline = block.timestamp + 10 minutes;
        address[] memory path = swapPath; // Use the path from constructor

        emit SwapStarted(msg.value, swapPath, _deadline);

        // swap using BlazeSwap
        (uint256[] memory _amountsSent, uint256[] memory _amountsRecv) = _swap(
            _amountIn,
            _amountOut,
            path,
            _deadline
        );

        emit SwapCompleted(_amountsSent, _amountsRecv);

        _redeemedAmountUBA = _redeem(_lots, _redeemerUnderlyingAddressString);

        emit Redeemed(_redeemedAmountUBA);

        return (
            _amountOut,
            _deadline,
            _amountsSent,
            _amountsRecv,
            _redeemedAmountUBA
        );
    }

    function _redeem(
        uint256 _lots,
        string memory _redeemerUnderlyingAddressString
    ) internal returns (uint256) {
        return
            assetManager.redeem(
                _lots,
                _redeemerUnderlyingAddressString,
                payable(address(0))
            );
    }

    function _swap(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] memory path,
        uint deadline
    )
        internal
        returns (uint256[] memory amountsSent, uint256[] memory amountsRecv)
    {
        (amountsSent, amountsRecv) = router.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            deadline
        );

        return (amountsSent, amountsRecv);
    }

    // Calculate the amount of input tokens needed to receive a specific amount of output tokens
    function _calculateAmountIn(
        uint256 amountOut,
        address[] calldata path
    ) internal view returns (uint256 amountIn) {
        uint256[] memory amounts = router.getAmountsIn(amountOut, path);
        return amounts[0];
    }
}
