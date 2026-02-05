// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

contract Checkpoint {
    mapping(address => uint256) public numberOfPasses;

    function passCheckpoint() public payable {
        ++numberOfPasses[msg.sender];
    }
}
