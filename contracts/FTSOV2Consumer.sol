// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { TestFtsoV2Interface } from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";
import { ContractRegistry } from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

contract FtsoV2Consumer {
    bytes21 public constant FLR_USD_ID = 0x01464c522f55534400000000000000000000000000; // "FLR/USD"

    // Feed IDs, see https://dev.flare.network/ftso/feeds for full list
    bytes21[] public feedIds = [
        bytes21(0x01464c522f55534400000000000000000000000000), // FLR/USD
        bytes21(0x014254432f55534400000000000000000000000000), // BTC/USD
        bytes21(0x014554482f55534400000000000000000000000000) // ETH/USD
    ];

    function getFlrUsdPrice() external view returns (uint256, int8, uint64) {
        /* THIS IS A TEST METHOD, in production use: ftsoV2 = ContractRegistry.getFtsoV2(); */
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        /* Your custom feed consumption logic. In this example the values are just returned. */
        return ftsoV2.getFeedById(FLR_USD_ID);
    }
    function getFlrUsdPriceWei() external view returns (uint256, uint64) {
        /* THIS IS A TEST METHOD, in production use: ftsoV2 = ContractRegistry.getFtsoV2(); */
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        /* Your custom feed consumption logic. In this example the values are just returned. */
        return ftsoV2.getFeedByIdInWei(FLR_USD_ID);
    }
    function getFtsoV2CurrentFeedValues()
        external
        view
        returns (uint256[] memory _feedValues, int8[] memory _decimals, uint64 _timestamp)
    {
        /* THIS IS A TEST METHOD, in production use: ftsoV2 = ContractRegistry.getFtsoV2(); */
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        /* Your custom feed consumption logic. In this example the values are just returned. */
        return ftsoV2.getFeedsById(feedIds);
    }
}
