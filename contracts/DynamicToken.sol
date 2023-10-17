// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IFtso} from "@flarenetwork/flare-periphery-contracts/coston2/ftso/userInterfaces/IFtso.sol";
import {IPriceSubmitter} from "@flarenetwork/flare-periphery-contracts/coston2/ftso/userInterfaces/IPriceSubmitter.sol";
import {IFtsoRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ftso/userInterfaces/IFtsoRegistry.sol";

import {FlareContractsRegistryLibrary} from "@flarenetwork/flare-periphery-contracts/coston2/util-contracts/ContractRegistryLibrary.sol";

error InsufficientBalance(uint256 available, uint256 required);
error OnylOwner();
error SupplyCeiling();

contract DynamicToken is ERC20 {
    address public immutable owner;

    string public nativeTokenSymbol;
    string public foreignTokenSymbol;
    uint256 public tokensPerForeignToken;

    uint256 public immutable maxSupply;

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert OnylOwner();
        }
        _;
    }

    constructor(
        uint256 _maxSupply,
        string memory _name,
        string memory _symbol,
        string memory _nativeTokenSymbol,
        string memory _foreignTokenSymbol,
        uint256 _tokensPerForeignToken
    ) ERC20(_name, _symbol) {
        maxSupply = _maxSupply;
        owner = msg.sender;
        nativeTokenSymbol = _nativeTokenSymbol;
        foreignTokenSymbol = _foreignTokenSymbol;
        tokensPerForeignToken = _tokensPerForeignToken;
    }

    function getTokenPriceWei() public view returns (uint256 natWeiPerToken) {
        IFtsoRegistry ftsoRegistry = FlareContractsRegistryLibrary
            .getFtsoRegistry();

        (
            uint256 foreignTokenToUsd,
            ,
            uint256 foreignTokenFTSODecimals
        ) = ftsoRegistry.getCurrentPriceWithDecimals(foreignTokenSymbol);
        (uint256 nativeToUsd, , uint256 nativeTokenFTSODecimals) = ftsoRegistry
            .getCurrentPriceWithDecimals(nativeTokenSymbol);

        natWeiPerToken =
            ((10 ** decimals()) *
                nativeTokenFTSODecimals *
                (10 ** foreignTokenToUsd)) /
            (nativeToUsd *
                tokensPerForeignToken *
                (10 ** 18) *
                (10 ** foreignTokenFTSODecimals));
    }

    function _mintCoins() private returns (uint256 tokenAmount) {
        uint256 price = getTokenPriceWei();

        tokenAmount = msg.value / price;
        uint256 remainder = msg.value - tokenAmount * price;

        _mint(msg.sender, tokenAmount);

        payable(msg.sender).transfer(remainder);
    }

    function mint() external payable returns (uint256) {
        return _mintCoins();
    }

    // Forward everything to deposit
    receive() external payable {
        _mintCoins();
    }

    fallback() external payable {
        _mintCoins();
    }

    function _afterTokenTransfer(
        address,
        address,
        uint256
    ) internal view override {
        require(totalSupply() <= maxSupply, "Supply ceiling reached");
    }

    function withdrawFunds() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}
