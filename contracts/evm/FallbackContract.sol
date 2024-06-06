// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

// A simple contract that accepts anything and emits event about information
contract FallbackContract {
    address public owner;

    event FallbackCalled(address sender, uint256 value, bytes data);

    constructor() {
        owner = msg.sender;
    }

    fallback() external payable {
        emit FallbackCalled(msg.sender, msg.value, msg.data);
    }

    function destroy() public {
        require(msg.sender == owner, "You are not the owner");
        selfdestruct(payable(owner));
    }
}
