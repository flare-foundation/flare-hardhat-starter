// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import {IFtsoRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ftso/userInterfaces/IFtsoRegistry.sol";

import {FlareContractsRegistryLibrary} from "@flarenetwork/flare-periphery-contracts/coston2/util-contracts/ContractRegistryLibrary.sol";

contract SimpleFtsoExample {
    function getCurrentTokenPriceWithDecimals(
        string memory foreignTokenSymbol
    )
        public
        view
        returns (uint256 _price, uint256 _timestamp, uint256 _decimals)
    {
        IFtsoRegistry ftsoRegistry = FlareContractsRegistryLibrary
            .getFtsoRegistry();

        (_price, _timestamp, _decimals) = ftsoRegistry
            .getCurrentPriceWithDecimals(foreignTokenSymbol);
    }

    function getTokenPriceInUSDWei(
        string memory foreignTokenSymbol
    )
        public
        view
        returns (uint256 _priceInUSDWei, uint256 _finalizedTimestamp)
    {
        IFtsoRegistry ftsoRegistry = FlareContractsRegistryLibrary
            .getFtsoRegistry();

        (uint256 _price, uint256 _timestamp, uint256 _decimals) = ftsoRegistry
            .getCurrentPriceWithDecimals(foreignTokenSymbol);

        require(_decimals <= 18, "decimals > 18");

        _priceInUSDWei = _price * (10 ** (18 - _decimals));
        return (_priceInUSDWei, _timestamp);
    }

    function getTokenPairPrice(
        string memory token1,
        string memory token2
    )
        public
        view
        returns (uint256 _price1, uint256 _price2, uint256 _timestamp)
    {
        IFtsoRegistry ftsoRegistry = FlareContractsRegistryLibrary
            .getFtsoRegistry();

        (
            uint256 _tPrice1,
            uint256 _timestamp1,
            uint256 decimals1
        ) = ftsoRegistry.getCurrentPriceWithDecimals(token1);

        (
            uint256 _tPrice2,
            uint256 _timestamp2,
            uint256 decimals2
        ) = ftsoRegistry.getCurrentPriceWithDecimals(token2);

        require(decimals1 <= 18, "decimals1 > 18");
        require(decimals2 <= 18, "decimals2 > 18");
        _price1 = _tPrice1 * (10 ** (18 - decimals1));
        _price2 = _tPrice2 * (10 ** (18 - decimals2));

        // This holds for V1
        require(_timestamp1 == _timestamp2, "timestamps not equal");

        return (_price1, _price2, _timestamp1);
    }

    // Checks if token1/token2 price ratio is higher than numerator/denominator
    // May overflow
    function isPriceRatioHigherThan(
        string memory token1,
        string memory token2,
        uint256 numerator,
        uint256 denominator
    ) public view returns (uint256 _price1, uint256 _price2, bool _is_higher) {
        (_price1, _price2, ) = getTokenPairPrice(token1, token2);

        _is_higher = _price1 * denominator > _price2 * numerator;
    }
}
