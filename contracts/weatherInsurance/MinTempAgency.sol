// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IWeb2Json} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

// All floats come multiplied by 10^6
struct DataTransportObject {
    int256 latitude;
    int256 longitude;
    string description;
    int256 temperature;
    int256 minTemp;
    uint256 windSpeed;
    uint256 windDeg;
}

contract MinTempAgency {
    enum PolicyStatus {
        Unclaimed,
        Open,
        Settled
    }

    struct Policy {
        address holder;
        int256 latitude;
        int256 longitude;
        uint256 startTimestamp;
        uint256 expirationTimestamp;
        int256 minTempThreshold;
        uint256 premium;
        uint256 coverage;
        PolicyStatus status;
        uint256 id;
    }

    Policy[] public registeredPolicies;
    mapping(uint256 => address) public insurers;

    event PolicyCreated(uint256 id);
    event PolicyClaimed(uint256 id);
    event PolicySettled(uint256 id);
    event PolicyExpired(uint256 id);
    event PolicyRetired(uint256 id);

    function createPolicy(
        int256 latitude,
        int256 longitude,
        uint256 startTimestamp,
        uint256 expirationTimestamp,
        int256 minTempThreshold,
        uint256 coverage
    ) public payable {
        require(msg.value > 0, "No premium paid");
        require(
            startTimestamp < expirationTimestamp,
            "Value of startTimestamp larger than expirationTimestamp"
        );

        Policy memory newPolicy = Policy({
            holder: msg.sender,
            latitude: latitude,
            longitude: longitude,
            startTimestamp: startTimestamp,
            expirationTimestamp: expirationTimestamp,
            minTempThreshold: minTempThreshold,
            premium: msg.value,
            coverage: coverage,
            status: PolicyStatus.Unclaimed,
            id: registeredPolicies.length
        });

        registeredPolicies.push(newPolicy);

        emit PolicyCreated(newPolicy.id);
    }

    function claimPolicy(uint256 id) public payable {
        Policy memory policy = registeredPolicies[id];
        require(
            policy.status == PolicyStatus.Unclaimed,
            "Policy already claimed"
        );
        if (block.timestamp > policy.startTimestamp) {
            retireUnclaimedPolicy(id);
        }
        require(msg.value >= policy.coverage, "Insufficient coverage paid");

        policy.status = PolicyStatus.Open;
        registeredPolicies[id] = policy;
        insurers[id] = msg.sender;

        payable(msg.sender).transfer(policy.premium);

        emit PolicyClaimed(id);
    }

    // TODO rethink expirations of policy
    function resolvePolicy(uint256 id, IWeb2Json.Proof calldata proof) public {
        Policy memory policy = registeredPolicies[id];
        require(policy.status == PolicyStatus.Open, "Policy not open");
        require(isJsonApiProofValid(proof), "Invalid proof");
        DataTransportObject memory dto = abi.decode(
            proof.data.responseBody.abiEncodedData,
            (DataTransportObject)
        );
        require(
            block.timestamp >= policy.startTimestamp,
            string.concat(
                "Policy not yet in effect: ",
                Strings.toString(block.timestamp),
                " vs. ",
                Strings.toString(policy.startTimestamp)
            )
        );
        if (block.timestamp > policy.expirationTimestamp) {
            expirePolicy(id);
            return;
        }

        require(
            dto.latitude == policy.latitude &&
                dto.longitude == policy.longitude,
            string.concat(
                "Invalid coordinates: ",
                Strings.toStringSigned(dto.latitude),
                ", ",
                Strings.toStringSigned(dto.longitude),
                " vs. ",
                Strings.toStringSigned(policy.latitude),
                ", ",
                Strings.toStringSigned(policy.longitude)
            )
        );

        require(
            dto.minTemp <= policy.minTempThreshold,
            string.concat(
                "Minimum temperature not met: ",
                Strings.toStringSigned(dto.minTemp),
                " vs. ",
                Strings.toStringSigned(policy.minTempThreshold)
            )
        );

        policy.status = PolicyStatus.Settled;
        registeredPolicies[id] = policy;
        payable(policy.holder).transfer(policy.coverage);
        emit PolicySettled(id);
    }

    function expirePolicy(uint256 id) public {
        Policy memory policy = registeredPolicies[id];
        require(policy.status == PolicyStatus.Open, "Policy not open");
        require(
            block.timestamp > policy.expirationTimestamp,
            "Policy not yet expired"
        );
        policy.status = PolicyStatus.Settled;
        registeredPolicies[id] = policy;
        payable(insurers[id]).transfer(policy.coverage);
        emit PolicyExpired(id);
    }

    function retireUnclaimedPolicy(uint256 id) public {
        Policy memory policy = registeredPolicies[id];
        require(
            policy.status == PolicyStatus.Unclaimed,
            "Policy not unclaimed"
        );
        require(
            block.timestamp > policy.startTimestamp,
            "Policy not yet expired"
        );
        policy.status = PolicyStatus.Settled;
        registeredPolicies[id] = policy;
        payable(policy.holder).transfer(policy.premium);

        emit PolicyRetired(id);
    }

    function getInsurer(uint256 id) public view returns (address) {
        return insurers[id];
    }

    function getAllPolicies() public view returns (Policy[] memory) {
        return registeredPolicies;
    }

    function abiSignatureHack(DataTransportObject memory dto) public pure {}

    function isJsonApiProofValid(
        IWeb2Json.Proof calldata _proof
    ) private view returns (bool) {
        return ContractRegistry.getFdcVerification().verifyJsonApi(_proof);
    }
}
