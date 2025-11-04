// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IOAppComposer } from "@layerzerolabs/oapp-evm/contracts/oapp/interfaces/IOAppComposer.sol";
import { OFTComposeMsgCodec } from "@layerzerolabs/oft-evm/contracts/libs/OFTComposeMsgCodec.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IAssetManager } from "@flarenetwork/flare-periphery-contracts/coston2/IAssetManager.sol";
import { ContractRegistry } from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

/// @title FAssetRedeemComposer
/// @author Flare Network
/// @notice Composer contract that automatically redeems FAssets when OFT tokens are received via LayerZero
/// @dev This contract receives OFT tokens and immediately redeems them through the FAsset system
contract FAssetRedeemComposer is IOAppComposer, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The LayerZero endpoint address
    address public immutable endpoint;

    /// @notice The FAsset token address (e.g., FTestXRP on Coston2)
    IERC20 public immutable fAssetToken;

    /// @notice Emitted when a redemption is successfully triggered
    /// @param redeemer The address initiating the redemption
    /// @param underlyingAddress The underlying address to receive redeemed assets
    /// @param amountRedeemed The amount of FAsset tokens redeemed
    /// @param lots The number of lots redeemed
    event RedemptionTriggered(
        address indexed redeemer,
        string underlyingAddress,
        uint256 indexed amountRedeemed,
        uint256 indexed lots
    );

    /// @notice Custom errors
    error OnlyEndpoint();
    error InsufficientBalance();
    error AmountTooSmall();

    /// @notice Constructor
    /// @param _endpoint The LayerZero endpoint address
    /// @param _fAssetToken The FAsset token address (e.g., FTestXRP)
    constructor(address _endpoint, address _fAssetToken) Ownable(msg.sender) {
        endpoint = _endpoint;
        fAssetToken = IERC20(_fAssetToken);
    }

    /// @notice Allow contract to receive native tokens for gas
    receive() external payable {}

    /// @notice Called by LayerZero endpoint when a compose message is received
    /// @param _message The compose message containing redemption details
    function lzCompose(
        address /* _from */,
        bytes32 /* _guid */,
        bytes calldata _message,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) external payable override nonReentrant {
        // Verify this is being called by the endpoint
        if (msg.sender != endpoint) revert OnlyEndpoint();

        // Extract and process the compose message
        bytes memory composeMsg = OFTComposeMsgCodec.composeMsg(_message);
        _processRedemption(composeMsg);
    }

    /// @notice Allows the owner to recover any stuck tokens
    /// @param token The token address to recover
    /// @param to The address to send recovered tokens to
    /// @param amount The amount to recover
    function recoverTokens(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    /// @notice Allows the owner to recover native tokens
    function recoverNative() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    /// @notice Internal function to process the redemption
    /// @param composeMsg The decoded compose message containing redemption details
    function _processRedemption(bytes memory composeMsg) internal {
        // Decode the compose message
        // Expected format: (amountToRedeem, underlyingAddress, redeemer)
        (uint256 amountToRedeem, string memory underlyingAddress, address redeemer) = abi.decode(
            composeMsg,
            (uint256, string, address)
        );

        // Get the balance of fAsset tokens this contract received
        uint256 balance = fAssetToken.balanceOf(address(this));
        if (balance < amountToRedeem) revert InsufficientBalance();

        // Convert amount to lots
        IAssetManager assetManager = ContractRegistry.getAssetManagerFXRP();
        uint256 lotSizeUBA = assetManager.lotSize();
        uint256 lots = amountToRedeem / lotSizeUBA;
        if (lots == 0) revert AmountTooSmall();

        // Approve the AssetManager to spend our fAsset tokens
        fAssetToken.safeIncreaseAllowance(address(assetManager), amountToRedeem);

        // Call redeem on the AssetManager
        uint256 redeemedAmount = assetManager.redeem(lots, underlyingAddress, payable(redeemer));

        emit RedemptionTriggered(redeemer, underlyingAddress, redeemedAmount, lots);
    }
}
