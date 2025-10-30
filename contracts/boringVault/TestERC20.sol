// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestERC20
 * @dev Simple ERC20 token for testing Boring Vault multi-asset functionality
 * Includes a public mint function for easy testing on testnets
 */
contract TestERC20 is ERC20, Ownable {
    uint8 private _decimals;

    /**
     * @dev Constructor that gives msg.sender an initial supply of tokens
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param decimals_ Number of decimals (6 for USDC-like, 8 for WBTC-like, 18 for most)
     * @param initialSupply_ Initial supply to mint to deployer
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        _decimals = decimals_;
        _mint(msg.sender, initialSupply_);
    }

    /**
     * @dev Mints tokens to a specific address (owner only)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Public faucet function for testing - anyone can mint up to 1000 tokens per call
     * @notice This should ONLY be used on testnets!
     */
    function faucet() external {
        uint256 amount = 1000 * (10 ** decimals());
        _mint(msg.sender, amount);
    }

    /**
     * @dev Burns tokens from caller's balance
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /**
     * @dev Returns the number of decimals used to get its user representation
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}
