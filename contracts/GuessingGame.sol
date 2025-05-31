// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {RandomNumberV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/RandomNumberV2Interface.sol";

contract GuessingGame {
    uint16 private _secretNumber;
    uint256 public _maxNumber;
    RandomNumberV2Interface public _generator;

    constructor(uint256 maxNumber) {
        require(
            maxNumber <= type(uint16).max,
            "Only numbers smaller than 65535 allowed"
        );
        _maxNumber = maxNumber;
        _generator = ContractRegistry.getRandomNumberV2();
        _setNewSecretNumber();
    }

    function resetGame() public {
        _setNewSecretNumber();
    }

    function guess(uint16 number) public view returns (string memory) {
        if (number > _maxNumber) {
            return
                string.concat(
                    "Numbers go only up to ",
                    Strings.toString(_maxNumber)
                );
        } else if (number > _secretNumber) {
            return "Too big";
        } else if (number < _secretNumber) {
            return "Too small";
        } else if (number == _secretNumber) {
            return "CORRECT!";
        } else {
            return "IMPOSSIBLE!";
        }
    }

    function _setNewSecretNumber() private {
        (uint256 randomNumber, , ) = _generator.getRandomNumber();
        randomNumber %= _maxNumber;
        _secretNumber = uint16(randomNumber);
    }
}
