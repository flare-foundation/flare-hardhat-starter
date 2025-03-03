// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenStateReader {
    event TotalTokenSupply(string chain, address tokenAddress, uint256 totalSupply);

    string chain;

    constructor(string memory _chain) {
        chain = _chain;
    }

    function broadcastTokenSupply(ERC20 token) external returns (uint256) {
        emit TotalTokenSupply(chain, address(token), token.totalSupply());
        return token.totalSupply();
    }
}
