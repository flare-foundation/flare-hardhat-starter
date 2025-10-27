// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {FixedPointMathLib} from "solady/src/utils/FixedPointMathLib.sol";
import {SafeTransferLib} from "solady/src/utils/SafeTransferLib.sol";
import {ERC20} from "solady/src/tokens/ERC20.sol";
import {IBeforeTransferHook} from "./interfaces/IBeforeTransferHook.sol";
import {Ownable} from "solady/src/auth/Ownable.sol";

contract BoringVault is ERC20, Ownable, ERC721Holder, ERC1155Holder {
    using Address for address;

    // ========================================= STATE =========================================

    /**
     * @notice Contract responsbile for implementing `beforeTransfer`.
     */
    IBeforeTransferHook public hook;

    /**
     * @notice Token name.
     */
    string private _name;

    /**
     * @notice Token symbol.
     */
    string private _symbol;

    //============================== EVENTS ===============================

    event Enter(
        address indexed from,
        address indexed asset,
        uint256 amount,
        address indexed to,
        uint256 shares
    );
    event Exit(
        address indexed to,
        address indexed asset,
        uint256 amount,
        address indexed from,
        uint256 shares
    );

    //============================== CONSTRUCTOR ===============================

    constructor(
        address _owner,
        string memory __name,
        string memory __symbol,
        uint8 /* _decimals */
    ) {
        _initializeOwner(_owner);
        _name = __name;
        _symbol = __symbol;
    }

    /// @dev Returns the name of the token.
    function name() public view override returns (string memory) {
        return _name;
    }

    /// @dev Returns the symbol of the token.
    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    /// @dev Returns the number of decimals for the token.
    function decimals() public pure override returns (uint8) {
        return 18;
    }

    //============================== MANAGE ===============================

    /**
     * @notice Allows manager to make an arbitrary function call from this contract.
     * @dev Callable by MANAGER_ROLE.
     */
    function manage(
        address target,
        bytes calldata data,
        uint256 value
    ) external onlyOwner returns (bytes memory result) {
        result = target.functionCallWithValue(data, value);
    }

    /**
     * @notice Allows manager to make arbitrary function calls from this contract.
     * @dev Callable by MANAGER_ROLE.
     */
    function manage(
        address[] calldata targets,
        bytes[] calldata data,
        uint256[] calldata values
    ) external onlyOwner returns (bytes[] memory results) {
        uint256 targetsLength = targets.length;
        results = new bytes[](targetsLength);
        for (uint256 i; i < targetsLength; ++i) {
            results[i] = targets[i].functionCallWithValue(data[i], values[i]);
        }
    }

    //============================== ENTER ===============================

    /**
     * @notice Allows minter to mint shares, in exchange for assets.
     * @dev If assetAmount is zero, no assets are transferred in.
     * @dev Callable by MINTER_ROLE.
     */
    function enter(
        address from,
        ERC20 asset,
        uint256 assetAmount,
        address to,
        uint256 shareAmount
    ) external onlyOwner {
        // Transfer assets in
        if (assetAmount > 0)
            SafeTransferLib.safeTransferFrom(
                address(asset),
                from,
                address(this),
                assetAmount
            );

        // Mint shares.
        _mint(to, shareAmount);

        emit Enter(from, address(asset), assetAmount, to, shareAmount);
    }

    //============================== EXIT ===============================

    /**
     * @notice Allows burner to burn shares, in exchange for assets.
     * @dev If assetAmount is zero, no assets are transferred out.
     * @dev Callable by BURNER_ROLE.
     */
    function exit(
        address to,
        ERC20 asset,
        uint256 assetAmount,
        address from,
        uint256 shareAmount
    ) external onlyOwner {
        // Burn shares.
        _burn(from, shareAmount);

        // Transfer assets out.
        if (assetAmount > 0)
            SafeTransferLib.safeTransfer(address(asset), to, assetAmount);

        emit Exit(to, address(asset), assetAmount, from, shareAmount);
    }

    //============================== BEFORE TRANSFER HOOK ===============================
    /**
     * @notice Sets the share locker.
     * @notice If set to zero address, the share locker logic is disabled.
     * @dev Callable by OWNER_ROLE.
     */
    function setBeforeTransferHook(address _hook) external onlyOwner {
        hook = IBeforeTransferHook(_hook);
    }

    /**
     * @notice Call `beforeTransferHook` passing in `from` `to`, and `msg.sender`.
     */
    function _callBeforeTransfer(address from, address to) internal view {
        if (address(hook) != address(0))
            hook.beforeTransfer(from, to, msg.sender);
    }

    function transfer(
        address to,
        uint256 amount
    ) public override returns (bool) {
        _callBeforeTransfer(msg.sender, to);
        return super.transfer(to, amount);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override returns (bool) {
        _callBeforeTransfer(from, to);
        return super.transferFrom(from, to, amount);
    }

    //============================== RECEIVE ===============================

    receive() external payable {}
}
