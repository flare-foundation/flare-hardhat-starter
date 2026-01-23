// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

contract PiggyBank {
    mapping(address => uint256) public balances;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() public {
        uint256 amount = balances[msg.sender];
        require(amount > 0);
        delete balances[msg.sender];
        (bool success, ) = payable(msg.sender).call{ value: amount }("");
        require(success);
    }
}
