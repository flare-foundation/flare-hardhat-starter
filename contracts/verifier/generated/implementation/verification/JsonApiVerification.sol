// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../../../interfaces/types/IJsonApi.sol";
import "../../interfaces/verification/IJsonApiVerification.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston/ContractRegistry.sol";

/**
 * Contract mocking verifying JsonApi attestations - FOR TESTNET USAGE ONLY
 */
contract JsonApiVerification is IJsonApiVerification {
    using MerkleProof for bytes32[];
    /**
     * @inheritdoc IJsonApiVerification
     */
    function verifyJsonApi(
        IJsonApi.Proof calldata _proof
    ) external view returns (bool _proved) {
        bytes32 merkleRoot = ContractRegistry.getRelay().merkleRoots(
            200,
            _proof.data.votingRound
        );
        return
            _proof.data.attestationType == bytes32("IJsonApi") &&
            _proof.merkleProof.verifyCalldata(
                merkleRoot,
                keccak256(abi.encode(_proof.data))
            );
    }
}
