// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { IOAppComposer } from "@layerzerolabs/oapp-evm/contracts/oapp/interfaces/IOAppComposer.sol";
import { OFTComposeMsgCodec } from "@layerzerolabs/oft-evm/contracts/libs/OFTComposeMsgCodec.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IAssetManager {
    function redeem(
        uint256 _lots,
        string memory _redeemerUnderlyingAddressString,
        address payable _executor
    ) external payable returns (uint256 _redeemedAmountUBA);

    function lotSize() external view returns (uint256 _lotSizeUBA);
    function fAsset() external view returns (IERC20);
}

/// @title FAssetRedeemComposer
/// @notice Composer contract that automatically redeems FAssets when OFT tokens are received via LayerZero
/// @dev This contract receives OFT tokens and immediately redeems them through the FAsset system
contract FAssetRedeemComposer is IOAppComposer, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The LayerZero endpoint address
    address public immutable endpoint;

    /// @notice The FAsset token address (e.g., FTestXRP on Coston2)
    IERC20 public immutable fAssetToken;

    /// @notice The AssetManager contract that handles redemptions
    IAssetManager public immutable assetManager;

    /// @notice Emitted when a redemption is successfully triggered
    event RedemptionTriggered(
        address indexed redeemer,
        string underlyingAddress,
        uint256 amountRedeemed,
        uint256 lots
    );

    /// @notice Custom errors
    error OnlyEndpoint();
    error InsufficientBalance();
    error AmountTooSmall();

    /// @notice Constructor
    /// @param _endpoint The LayerZero endpoint address
    /// @param _fAssetToken The FAsset token address (e.g., FTestXRP)
    /// @param _assetManager The AssetManager contract address
    constructor(
        address _endpoint,
        address _fAssetToken,
        address _assetManager
    ) Ownable(msg.sender) {
        endpoint = _endpoint;
        fAssetToken = IERC20(_fAssetToken);
        assetManager = IAssetManager(_assetManager);
    }

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

        // Extract the composeMsg from the OFT message
        bytes memory composeMsg = OFTComposeMsgCodec.composeMsg(_message);

        // Decode the compose message
        // Expected format: (amountToRedeem, underlyingAddress, redeemer)
        (uint256 amountToRedeem, string memory underlyingAddress, address redeemer) =
            abi.decode(composeMsg, (uint256, string, address));

        // Get the balance of fAsset tokens this contract received
        uint256 balance = fAssetToken.balanceOf(address(this));
        if (balance < amountToRedeem) revert InsufficientBalance();

        // Convert amount to lots
        uint256 lotSizeUBA = assetManager.lotSize();
        // Assuming the token has the same decimals as UBA
        uint256 lots = amountToRedeem / lotSizeUBA;
        if (lots == 0) revert AmountTooSmall();

        // Approve the AssetManager to spend our fAsset tokens
        fAssetToken.safeIncreaseAllowance(address(assetManager), amountToRedeem);

        // Call redeem on the AssetManager
        // The executor will typically be address(0) or a trusted executor
        uint256 redeemedAmount = assetManager.redeem(
            lots,
            underlyingAddress,
            payable(redeemer)
        );

        emit RedemptionTriggered(redeemer, underlyingAddress, redeemedAmount, lots);

        // Note: Any remaining fAsset tokens stay in this contract
        // You may want to add a function to sweep remaining tokens
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

    /// @notice Allow contract to receive native tokens for gas
    receive() external payable {}
}
