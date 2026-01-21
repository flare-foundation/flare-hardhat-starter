// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IOAppComposer } from "@layerzerolabs/oapp-evm/contracts/oapp/interfaces/IOAppComposer.sol";
import { OFTComposeMsgCodec } from "@layerzerolabs/oft-evm/contracts/libs/OFTComposeMsgCodec.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HyperliquidComposer
 * @author Flare Network
 * @notice Composer contract that receives tokens via LayerZero and forwards them to HyperCore
 * @dev Transfers ERC20 tokens to the Hyperliquid system address to credit them on HyperCore
 *
 * To transfer from HyperEVM to HyperCore, you transfer ERC20 tokens to the token's system address.
 * The system address format is: 0x20 + zeros + token_index (big-endian)
 * The Transfer event signals Hyperliquid's backend to credit the tokens on HyperCore.
 */
contract HyperliquidComposer is IOAppComposer, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable endpoint;
    address public immutable token;
    address public systemAddress;

    event TransferToHyperCore(address indexed sender, address indexed recipient, uint256 indexed amount);

    event SystemAddressUpdated(address indexed oldAddress, address indexed newAddress);

    error OnlyEndpoint();
    error InsufficientBalance();
    error InvalidSystemAddress();

    /**
     * @notice Constructor that initializes the HyperliquidComposer
     * @param _endpoint The LayerZero endpoint address on HyperEVM
     * @param _token The ERC20 token address on HyperEVM (e.g., FXRP OFT)
     * @param _systemAddress The Hyperliquid system address for this token (for HyperCore transfers)
     */
    constructor(address _endpoint, address _token, address _systemAddress) Ownable(msg.sender) {
        endpoint = _endpoint;
        token = _token;
        systemAddress = _systemAddress;
    }

    receive() external payable {}

    /**
     * @notice Called by LayerZero endpoint when a composed message arrives
     * @param _message The composed message containing transfer details
     */
    function lzCompose(
        address /* _from */,
        bytes32 /* _guid */,
        bytes calldata _message,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) external payable override nonReentrant {
        if (msg.sender != endpoint) revert OnlyEndpoint();

        bytes memory composeMsg = OFTComposeMsgCodec.composeMsg(_message);
        _processTransferToHyperCore(composeMsg);
    }

    /**
     * @notice Updates the system address for HyperCore transfers
     * @param _newSystemAddress The new system address
     */
    function setSystemAddress(address _newSystemAddress) external onlyOwner {
        if (_newSystemAddress == address(0)) revert InvalidSystemAddress();
        address oldAddress = systemAddress;
        systemAddress = _newSystemAddress;
        emit SystemAddressUpdated(oldAddress, _newSystemAddress);
    }

    /**
     * @notice Recovers ERC20 tokens accidentally sent to this contract
     * @param _token The token address to recover
     * @param to The address to send recovered tokens to
     * @param amount The amount to recover
     */
    function recoverTokens(address _token, address to, uint256 amount) external onlyOwner {
        IERC20(_token).safeTransfer(to, amount);
    }

    /**
     * @notice Recovers native tokens accidentally sent to this contract
     */
    function recoverNative() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    /**
     * @notice Processes the transfer to HyperCore
     * @param composeMsg The decoded compose message containing (amount, recipient)
     */
    function _processTransferToHyperCore(bytes memory composeMsg) internal {
        // Decode message: (amount, recipientAddress)
        // recipientAddress is the HyperCore address that will receive the tokens
        (, address recipient) = abi.decode(composeMsg, (uint256, address));

        // Get actual balance received from LayerZero
        uint256 currentBalance = IERC20(token).balanceOf(address(this));
        if (currentBalance == 0) revert InsufficientBalance();

        // Transfer to system address to credit on HyperCore
        // The Transfer event signals Hyperliquid's backend to credit recipient on HyperCore
        IERC20(token).safeTransfer(systemAddress, currentBalance);

        emit TransferToHyperCore(msg.sender, recipient, currentBalance);
    }
}
