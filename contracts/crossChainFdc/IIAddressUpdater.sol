// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6 <0.9;
pragma abicoder v2;

/**
 * Internal interface for AddressUpdater.
 */
interface IIAddressUpdater {
    /**
     * Returns all contract names and corresponding addresses currently being tracked.
     * @return _contractNames Array of contract names.
     * @return _contractAddresses Array of contract addresses.
     */
    function getContractNamesAndAddresses()
        external
        view
        returns (string[] memory _contractNames, address[] memory _contractAddresses);

    /**
     * Returns contract address for the given name, which might be address(0).
     * @param _name Name of the contract to query.
     * @return Current address for the queried contract.
     */
    function getContractAddress(string calldata _name) external view returns (address);

    /**
     * Returns contract address for the given name hash, which might be address(0).
     * @param _nameHash Hash of the contract name: `keccak256(abi.encode(name))`
     * @return Current address for the queried contract.
     */
    function getContractAddressByHash(bytes32 _nameHash) external view returns (address);

    /**
     * Returns contract addresses for the given names, which might be address(0).
     * @param _names Names of the contracts to query.
     * @return Current addresses for the queried contracts.
     */
    function getContractAddresses(string[] calldata _names) external view returns (address[] memory);

    /**
     * Returns contract addresses for the given name hashes, which might be address(0).
     * @param _nameHashes Hashes of the contract names: `keccak256(abi.encode(name))`
     * @return Current addresses for the queried contracts.
     */
    function getContractAddressesByHash(bytes32[] calldata _nameHashes) external view returns (address[] memory);
}
