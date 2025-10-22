// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import { FAssetOFT } from "./FAssetOFT.sol";

contract FXRPOFT is FAssetOFT {
    constructor(address _lzEndpoint)
        FAssetOFT(_lzEndpoint)
    {}

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
