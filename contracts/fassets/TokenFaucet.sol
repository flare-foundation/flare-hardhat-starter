// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract TokenFaucet is Ownable, ReentrancyGuard, Pausable {
    mapping(address => bool) public isAdmin;
    mapping(address => bool) public isFaucetUser;

    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    event FaucetUserAdded(address indexed user);
    event FaucetUserRemoved(address indexed user);

    event FaucetSent(address indexed recipient, uint256 amount, address token);
    event FaucetPaused(address indexed by);
    event FaucetUnpaused(address indexed by);

    modifier onlyAdmin() {
        require(isAdmin[msg.sender] || msg.sender == owner(), "Not admin");
        _;
    }

    modifier onlyFaucetUser() {
        require(isFaucetUser[msg.sender], "Not authorized faucet user");
        _;
    }

    modifier validAddress(address addr) {
        require(addr != address(0), "Invalid address");
        _;
    }

    constructor() Ownable(msg.sender) {
        isAdmin[msg.sender] = true;
    }

    // Add faucet user
    function addFaucetUser(address user) external onlyAdmin validAddress(user) {
        isFaucetUser[user] = true;
        emit FaucetUserAdded(user);
    }

    // Remove faucet user
    function removeFaucetUser(
        address user
    ) external onlyAdmin validAddress(user) {
        isFaucetUser[user] = false;
        emit FaucetUserRemoved(user);
    }

    // Add admin
    function addAdmin(address admin) external onlyOwner validAddress(admin) {
        require(!isAdmin[admin], "Already an admin");
        isAdmin[admin] = true;
        emit AdminAdded(admin);
    }

    // Remove admin
    function removeAdmin(address admin) external onlyOwner validAddress(admin) {
        isAdmin[admin] = false;
        emit AdminRemoved(admin);
    }

    // Pause faucet operations
    function pauseFaucet() external onlyAdmin {
        _pause();
        emit FaucetPaused(msg.sender);
    }

    // Unpause faucet operations
    function unpauseFaucet() external onlyAdmin {
        _unpause();
        emit FaucetUnpaused(msg.sender);
    }

    // Main faucet function
    function faucetTo(
        address recipient,
        uint256 amount,
        address tokenAddress
    )
        external
        onlyFaucetUser
        nonReentrant
        whenNotPaused
        validAddress(recipient)
        validAddress(tokenAddress)
    {
        require(amount > 0, "Amount must be greater than 0");

        // Validate token contract
        IERC20 token = IERC20(tokenAddress);
        require(
            token.balanceOf(address(this)) >= amount,
            "Insufficient faucet balance"
        );

        // Transfer tokens
        require(token.transfer(recipient, amount), "Token transfer failed");
        emit FaucetSent(recipient, amount, tokenAddress);
    }

    // Emergency function to recover tokens (owner only)
    function emergencyWithdraw(
        address tokenAddress,
        address recipient,
        uint256 amount
    ) external onlyOwner validAddress(recipient) validAddress(tokenAddress) {
        IERC20 token = IERC20(tokenAddress);
        require(
            token.balanceOf(address(this)) >= amount,
            "Insufficient balance"
        );
        require(token.transfer(recipient, amount), "Token transfer failed");
    }

    // Allow receiving ERC-20 tokens (via `transfer`)
    function tokenBalance(
        address tokenAddress
    ) external view validAddress(tokenAddress) returns (uint256) {
        return IERC20(tokenAddress).balanceOf(address(this));
    }

    // Check if user is authorized to use faucet
    function canUserFaucet(address user) external view returns (bool) {
        return isFaucetUser[user];
    }
}
