// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import { OFTFeeUpgradeable } from "@layerzerolabs/oft-evm-upgradeable/contracts/oft/OFTFeeUpgradeable.sol";

contract FAssetOFT is OFTFeeUpgradeable {
    constructor(address _lzEndpoint)
        OFTFeeUpgradeable(_lzEndpoint)
    {
        _disableInitializers();
    }

    function initialize(string memory _name, string memory _symbol, address _owner)
        public
        initializer
    {
        __Ownable_init(_owner);
        __OFTFee_init(_name, _symbol, _owner);
    }
}
