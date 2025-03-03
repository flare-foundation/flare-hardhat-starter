// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

contract HelloWorld {
    string public greet = "Hello World!";
    string private world;

    constructor(string memory name) {
        world = name;
    }

    function greetWorld() public view returns (string memory worldGreeting) {
        worldGreeting = string.concat("Hello, ", world, "!");
    }

    function greetByName(
        string memory name
    ) public pure returns (string memory personalizedGreeting) {
        personalizedGreeting = string.concat("Hello, ", name, "!");
    }
}
