// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IIAddressUpdater.sol";
import "./AddressUpdatable.sol";
import "@flarenetwork/flare-periphery-contracts/coston2/IRelay.sol";
import "./IFdcVerification.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * FdcVerification contract.
 *
 * This contract is used to verify FDC attestations.
 */
contract FdcVerification is IFdcVerificationOld, AddressUpdatable {
    using MerkleProof for bytes32[];

    /// The FDC protocol id.
    uint8 public immutable fdcProtocolId;

    /// The Relay contract.
    IRelay public relay;

    /**
     * Constructor.
     * @param _addressUpdater The address of the AddressUpdater contract.
     * @param _fdcProtocolId The FDC protocol id.
     */
    constructor(
        address _addressUpdater,
        uint8 _fdcProtocolId
    ) AddressUpdatable(_addressUpdater) {
        fdcProtocolId = _fdcProtocolId;
    }

    // HACK:(Nik)
    function updateRelay() external {
        address _addressUpdater = getAddressUpdater();
        address _relay = IIAddressUpdater(_addressUpdater)
            .getContractAddressByHash(keccak256(abi.encode("Relay")));
        relay = IRelay(_relay);
    }

    /**
     * @inheritdoc IAddressValidityVerificationOther
     */
    function verifyAddressValidity(
        IAddressValidity.Proof calldata _proof
    ) external payable returns (bool _proved) {
        return
            _proof.data.attestationType == bytes32("AddressValidity") &&
            relay.verify{value: msg.value}(
                fdcProtocolId,
                _proof.data.votingRound,
                keccak256(abi.encode(_proof.data)),
                _proof.merkleProof
            );
    }

    /**
     * @inheritdoc IBalanceDecreasingTransactionVerificationOther
     */
    function verifyBalanceDecreasingTransaction(
        IBalanceDecreasingTransaction.Proof calldata _proof
    ) external payable returns (bool _proved) {
        return
            _proof.data.attestationType ==
            bytes32("BalanceDecreasingTransaction") &&
            relay.verify{value: msg.value}(
                fdcProtocolId,
                _proof.data.votingRound,
                keccak256(abi.encode(_proof.data)),
                _proof.merkleProof
            );
    }

    /**
     * @inheritdoc IConfirmedBlockHeightExistsVerificationOther
     */
    function verifyConfirmedBlockHeightExists(
        IConfirmedBlockHeightExists.Proof calldata _proof
    ) external payable returns (bool _proved) {
        return
            _proof.data.attestationType ==
            bytes32("ConfirmedBlockHeightExists") &&
            relay.verify{value: msg.value}(
                fdcProtocolId,
                _proof.data.votingRound,
                keccak256(abi.encode(_proof.data)),
                _proof.merkleProof
            );
    }

    /**
     * @inheritdoc IEVMTransactionVerificationOther
     */
    function verifyEVMTransaction(
        IEVMTransaction.Proof calldata _proof
    ) external payable returns (bool _proved) {
        return
            _proof.data.attestationType == bytes32("EVMTransaction") &&
            relay.verify{value: msg.value}(
                fdcProtocolId,
                _proof.data.votingRound,
                keccak256(abi.encode(_proof.data)),
                _proof.merkleProof
            );
    }

    /**
     * @inheritdoc IPaymentVerificationOther
     */
    function verifyPayment(
        IPayment.Proof calldata _proof
    ) external payable returns (bool _proved) {
        return
            _proof.data.attestationType == bytes32("Payment") &&
            relay.verify{value: msg.value}(
                fdcProtocolId,
                _proof.data.votingRound,
                keccak256(abi.encode(_proof.data)),
                _proof.merkleProof
            );
    }

    /**
     * @inheritdoc IReferencedPaymentNonexistenceVerificationOther
     */
    function verifyReferencedPaymentNonexistence(
        IReferencedPaymentNonexistence.Proof calldata _proof
    ) external payable returns (bool _proved) {
        return
            _proof.data.attestationType ==
            bytes32("ReferencedPaymentNonexistence") &&
            relay.verify{value: msg.value}(
                fdcProtocolId,
                _proof.data.votingRound,
                keccak256(abi.encode(_proof.data)),
                _proof.merkleProof
            );
    }

    /**
     * @inheritdoc IJsonApiVerificationOther
     */
    function verifyJsonApi(
        IWeb2Json.Proof calldata _proof
    ) external payable returns (bool _proved) {
        return
            _proof.data.attestationType == bytes32("Web2Json") &&
            relay.verify{value: msg.value}(
                fdcProtocolId,
                _proof.data.votingRound,
                keccak256(abi.encode(_proof.data)),
                _proof.merkleProof
            );
    }

    /**
     * Implementation of the AddressUpdatable abstract method.
     * @dev It can be overridden if other contracts are needed.
     */
    function _updateContractAddresses(
        bytes32[] memory _contractNameHashes,
        address[] memory _contractAddresses
    ) internal virtual override {
        relay = IRelay(
            _getContractAddress(
                _contractNameHashes,
                _contractAddresses,
                "Relay"
            )
        );
    }
}
