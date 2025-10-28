// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6;
pragma abicoder v2;

import "./GovernedOld.sol";
import "./IIAddressUpdatableOld.sol";
import "./IIAddressUpdater.sol";

/**
 * Keeps track of the current address for all unique and special platform contracts.
 *
 * This contract keeps a list of addresses that gets updated by governance every time
 * any of the tracked contracts is redeployed.
 * This list is then used by the `FlareContractRegistry`, and also by `AddressUpdatable`
 * to inform all dependent contracts of any address change.
 */
contract AddressUpdater is IIAddressUpdater, GovernedOld {
    string internal constant ERR_ARRAY_LENGTHS = "array lengths do not match";
    string internal constant ERR_ADDRESS_ZERO = "address zero";

    string[] internal contractNames;
    mapping(bytes32 => address) internal contractAddresses;

    constructor(address _governance) GovernedOld(_governance) {}

    /**
     * Set or update contract names and addresses, and then apply changes to specific contracts.
     *
     * This is a combination of `addOrUpdateContractNamesAndAddresses` and `updateContractAddresses`.
     * Can only be called by governance.
     * @param _contractNames Contracts names.
     * @param _contractAddresses Addresses of corresponding contracts names.
     * @param _contractsToUpdate Contracts to be updated.
     */
    function update(
        string[] memory _contractNames,
        address[] memory _contractAddresses,
        IIAddressUpdatable[] memory _contractsToUpdate
    ) external onlyGovernance {
        _addOrUpdateContractNamesAndAddresses(_contractNames, _contractAddresses);
        _updateContractAddresses(_contractsToUpdate);
    }

    /**
     * Updates contract addresses on specific contracts.
     *
     * Can only be called by governance.
     * @param _contractsToUpdate Contracts to be updated, which must implement the
     * `IIAddressUpdatable` interface.
     */
    function updateContractAddresses(IIAddressUpdatable[] memory _contractsToUpdate) external onlyImmediateGovernance {
        _updateContractAddresses(_contractsToUpdate);
    }

    /**
     * Add or update contract names and addresses that are later used in `updateContractAddresses` calls.
     *
     * Can only be called by governance.
     * @param _contractNames Contracts names.
     * @param _contractAddresses Addresses of corresponding contracts names.
     */
    function addOrUpdateContractNamesAndAddresses(
        string[] memory _contractNames,
        address[] memory _contractAddresses
    ) external onlyGovernance {
        _addOrUpdateContractNamesAndAddresses(_contractNames, _contractAddresses);
    }

    /**
     * Remove contracts with given names.
     *
     * Can only be called by governance.
     * @param _contractNames Contract names.
     */
    function removeContracts(string[] memory _contractNames) external onlyGovernance {
        for (uint256 i = 0; i < _contractNames.length; i++) {
            string memory contractName = _contractNames[i];
            bytes32 nameHash = _keccak256AbiEncode(contractName);
            require(contractAddresses[nameHash] != address(0), ERR_ADDRESS_ZERO);
            delete contractAddresses[nameHash];
            uint256 index = contractNames.length;
            while (index > 0) {
                index--;
                if (nameHash == _keccak256AbiEncode(contractNames[index])) {
                    break;
                }
            }
            contractNames[index] = contractNames[contractNames.length - 1];
            contractNames.pop();
        }
    }

    /**
     * @inheritdoc IIAddressUpdater
     */
    function getContractNamesAndAddresses()
        external
        view
        override
        returns (string[] memory _contractNames, address[] memory _contractAddresses)
    {
        _contractNames = contractNames;
        uint256 len = _contractNames.length;
        _contractAddresses = new address[](len);
        while (len > 0) {
            len--;
            _contractAddresses[len] = contractAddresses[_keccak256AbiEncode(_contractNames[len])];
        }
    }

    /**
     * @inheritdoc IIAddressUpdater
     */
    function getContractAddress(string calldata _name) external view override returns (address) {
        return contractAddresses[_keccak256AbiEncode(_name)];
    }

    /**
     * @inheritdoc IIAddressUpdater
     */
    function getContractAddressByHash(bytes32 _nameHash) external view override returns (address) {
        return contractAddresses[_nameHash];
    }

    /**
     * @inheritdoc IIAddressUpdater
     */
    function getContractAddresses(string[] calldata _names) external view override returns (address[] memory) {
        address[] memory addresses = new address[](_names.length);
        for (uint256 i = 0; i < _names.length; i++) {
            addresses[i] = contractAddresses[_keccak256AbiEncode(_names[i])];
        }
        return addresses;
    }

    /**
     * @inheritdoc IIAddressUpdater
     */
    function getContractAddressesByHash(
        bytes32[] calldata _nameHashes
    ) external view override returns (address[] memory) {
        address[] memory addresses = new address[](_nameHashes.length);
        for (uint256 i = 0; i < _nameHashes.length; i++) {
            addresses[i] = contractAddresses[_nameHashes[i]];
        }
        return addresses;
    }

    /**
     * Add or update contract names and addresses that are later used in updateContractAddresses calls
     * @param _contractNames                contracts names
     * @param _contractAddresses            addresses of corresponding contracts names
     */
    function _addOrUpdateContractNamesAndAddresses(
        string[] memory _contractNames,
        address[] memory _contractAddresses
    ) internal {
        uint256 len = _contractNames.length;
        require(len == _contractAddresses.length, ERR_ARRAY_LENGTHS);

        for (uint256 i = 0; i < len; i++) {
            require(_contractAddresses[i] != address(0), ERR_ADDRESS_ZERO);
            bytes32 nameHash = _keccak256AbiEncode(_contractNames[i]);
            // add new contract name if address is not known yet
            if (contractAddresses[nameHash] == address(0)) {
                contractNames.push(_contractNames[i]);
            }
            // set or update contract address
            contractAddresses[nameHash] = _contractAddresses[i];
        }
    }

    /**
     * Updates contract addresses on all contracts implementing IIAddressUpdatable interface
     * @param _contractsToUpdate            contracts to be updated
     */
    function _updateContractAddresses(IIAddressUpdatable[] memory _contractsToUpdate) internal {
        uint256 len = contractNames.length;
        bytes32[] memory nameHashes = new bytes32[](len);
        address[] memory addresses = new address[](len);
        while (len > 0) {
            len--;
            nameHashes[len] = _keccak256AbiEncode(contractNames[len]);
            addresses[len] = contractAddresses[nameHashes[len]];
        }

        for (uint256 i = 0; i < _contractsToUpdate.length; i++) {
            _contractsToUpdate[i].updateContractAddresses(nameHashes, addresses);
        }
    }

    /**
     * Returns hash from string value.
     */
    function _keccak256AbiEncode(string memory _value) internal pure returns (bytes32) {
        return keccak256(abi.encode(_value));
    }
}
