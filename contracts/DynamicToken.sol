// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// WARNING: This is a test contract, do not use it in production
import {TestFtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IFtsoFeedIdConverter} from "@flarenetwork/flare-periphery-contracts/coston2/IFtsoFeedIdConverter.sol";

error InsufficientBalance(uint256 available, uint256 required);
error OnylOwner();
error SupplyCeiling();

contract DynamicToken is ERC20 {
    address public immutable owner;

    string public nativeTokenSymbol;
    bytes21 public nativeTokenFeedId;
    string public denominatingTokenSymbol;
    bytes21 public denominatingTokenFeedId;
    uint256 public tokensPerDenominatingToken;

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert OnylOwner();
        }
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _nativeTokenSymbol,
        string memory _denominatingTokenSymbol,
        uint256 _tokensPerDenominatingToken
    ) ERC20(_name, _symbol) {
        owner = msg.sender;

        nativeTokenSymbol = _nativeTokenSymbol;
        denominatingTokenSymbol = _denominatingTokenSymbol;

        tokensPerDenominatingToken = _tokensPerDenominatingToken;

        IFtsoFeedIdConverter feedIdConverter = ContractRegistry
            .getFtsoFeedIdConverter();
        nativeTokenFeedId = feedIdConverter.getFeedId(1, _nativeTokenSymbol);
        denominatingTokenFeedId = feedIdConverter.getFeedId(
            1,
            _denominatingTokenSymbol
        );
    }

    // TODO: Check this function
    function getTokenPriceWei() public view returns (uint256 natWeiPerToken) {
        // WARNING: This is a test contract, do not use it in production
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();

        (
            uint256 denominatingTokenPrice,
            int8 denominatingTokenFTSODecimals,

        ) = ftsoV2.getFeedById(denominatingTokenFeedId);
        (uint256 nativeToUsd, int8 nativeTokenFTSODecimals, ) = ftsoV2
            .getFeedById(nativeTokenFeedId);

        // A bit more involved calculation to avoid to many numerical errors

        uint256 weiPerToken = (10 ** uint256(decimals())) *
            (10 ** denominatingTokenPrice);
        if (nativeTokenFTSODecimals >= 0) {
            weiPerToken *= 10 ** uint256(uint8(nativeTokenFTSODecimals));
        }
        if (denominatingTokenFTSODecimals < 0) {
            weiPerToken *= 10 ** uint256(uint8(denominatingTokenFTSODecimals));
        }

        if (nativeTokenFTSODecimals < 0) {
            natWeiPerToken /= 10 ** uint256(uint8(-nativeTokenFTSODecimals));
        }
        if (denominatingTokenFTSODecimals > 0) {
            natWeiPerToken /=
                10 ** uint256(uint8(denominatingTokenFTSODecimals));
        }

        natWeiPerToken /= nativeToUsd * (tokensPerDenominatingToken * 10 ** 18);
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

    function withdrawFunds() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}
