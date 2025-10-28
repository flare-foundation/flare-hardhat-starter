// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IRateProvider } from "../interfaces/IRateProvider.sol";
import { IFtsoRegistry } from "@flarenetwork/flare-periphery-contracts/coston2/IFtsoRegistry.sol";

/**
 * @title SimpleFTSORateProvider
 * @notice Minimal FTSO rate provider without staleness checks (for testing)
 * @dev Use FTSORateProvider for production!
 *
 * This simplified version:
 * - No staleness validation (accepts any price age)
 * - No admin functions
 * - Perfect for testnet/demo purposes
 * - DO NOT use in production!
 */
contract SimpleFTSORateProvider is IRateProvider {
    IFtsoRegistry public immutable ftsoRegistry;
    string public symbol;
    uint8 public immutable rateDecimals;

    constructor(address _ftsoRegistry, string memory _symbol, uint8 _rateDecimals) {
        ftsoRegistry = IFtsoRegistry(_ftsoRegistry);
        symbol = _symbol;
        rateDecimals = _rateDecimals;
    }

    function getRate() external view override returns (uint256) {
        (uint256 price, , uint256 ftsoDecimals) = ftsoRegistry.getCurrentPriceWithDecimals(symbol);

        // Scale to desired decimals
        if (ftsoDecimals == rateDecimals) {
            return price;
        } else if (ftsoDecimals < rateDecimals) {
            return price * (10 ** (rateDecimals - uint8(ftsoDecimals)));
        } else {
            return price / (10 ** (uint8(ftsoDecimals) - rateDecimals));
        }
    }
}
