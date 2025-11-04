// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { FAssetOFT } from "./FAssetOFT.sol";

/**
 * @title FXRPOFT
 * @author Flare Network
 * @notice FXRP Omnichain Fungible Token with 6 decimal places
 */
contract FXRPOFT is FAssetOFT {
    /**
     * @notice Constructor that initializes the FXRPOFT with LayerZero endpoint
     * @param _lzEndpoint The LayerZero endpoint address
     */
    constructor(address _lzEndpoint) FAssetOFT(_lzEndpoint) {}

    /**
     * @notice Returns the number of decimals used for the FXRP token
     * @return The number of decimals (6 for FXRP)
     */
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
