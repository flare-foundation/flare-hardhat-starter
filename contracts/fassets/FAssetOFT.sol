// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OFTFeeUpgradeable } from "@layerzerolabs/oft-evm-upgradeable/contracts/oft/OFTFeeUpgradeable.sol";

/**
 * @title FAssetOFT
 * @author LayerZero Labs
 * @notice Upgradeable Omnichain Fungible Token (OFT) implementation for FAssets with fee support
 */
contract FAssetOFT is OFTFeeUpgradeable {
    /**
     * @notice Constructor that disables initializers to prevent implementation contract initialization
     * @param _lzEndpoint The LayerZero endpoint address
     */
    constructor(address _lzEndpoint) OFTFeeUpgradeable(_lzEndpoint) {
        _disableInitializers();
    }

    /**
     * @notice Initializes the FAssetOFT contract with token details and ownership
     * @param _name The name of the token
     * @param _symbol The symbol of the token
     * @param _owner The address that will own the contract
     */
    function initialize(string memory _name, string memory _symbol, address _owner) public initializer {
        __Ownable_init(_owner);
        __OFTFee_init(_name, _symbol, _owner);
    }
}
