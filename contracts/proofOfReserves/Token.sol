// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MyStablecoin is ERC20, ERC20Burnable, Ownable, ERC20Permit {
    constructor(
        address recipient,
        address initialOwner
    )
        ERC20("MyStablecoin", "MST")
        Ownable(initialOwner)
        ERC20Permit("MyStablecoin")
    {
        _mint(recipient, 666 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
