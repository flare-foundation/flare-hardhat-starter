// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import { OFTAdapterFeeUpgradeable } from "@layerzerolabs/oft-evm-upgradeable/contracts/oft/OFTAdapterFeeUpgradeable.sol";

/**
 * @title OFTAdapter Contract
 * @dev OFTAdapter is a contract that adapts an ERC-20 token to the OFT functionality.
 *
 * @dev For existing ERC20 tokens, this can be used to convert the token to crosschain compatibility.
 * @dev WARNING: ONLY 1 of these should exist for a given global mesh,
 * unless you make a NON-default implementation of OFT and needs to be done very carefully.
 * @dev WARNING: The default OFTAdapter implementation assumes LOSSLESS transfers, ie. 1 token in, 1 token out.
 * IF the 'innerToken' applies something like a transfer fee, the default will NOT work...
 * a pre/post balance check will need to be done to calculate the amountSentLD/amountReceivedLD.
 */
contract FAssetOFTAdapter is OFTAdapterFeeUpgradeable {
    constructor(
        address _token,
        address _lzEndpoint
    )
        OFTAdapterFeeUpgradeable(_token, _lzEndpoint)
    {
       _disableInitializers();
    }

    function initialize(
        address _owner
    )
        external
        initializer
    {
        __OFTAdapterFee_init(_owner);
        __Ownable_init(_owner);
    }
}
