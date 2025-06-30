// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6 <0.9;


/**
 * Internal interface for contracts that depend on other contracts whose addresses can change.
 *
 * See `AddressUpdatable`.
 */
interface IIAddressUpdatable {
    /**
     * Updates contract addresses.
     * Can only be called from the `AddressUpdater` contract typically set at construction time.
     * @param _contractNameHashes List of keccak256(abi.encode(...)) contract names.
     * @param _contractAddresses List of contract addresses corresponding to the contract names.
     */
    function updateContractAddresses(
        bytes32[] memory _contractNameHashes,
        address[] memory _contractAddresses
        ) external;
}
