// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IEVMTransaction} from "@flarenetwork/flare-periphery-contracts/coston2/IEVMTransaction.sol";
import {IWeb2Json} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

struct DataTransportObject {
    uint256 reserves;
}

contract ProofOfReserves is Ownable {
    uint256 public debugTokenReserves = 0;
    uint256 public debugClaimedReserves = 0;

    mapping(address => address) public tokenStateReaders;

    // Two events and values for debug purposes
    event GoodPair(address reader, address token, uint256 totalSupply);
    event BadPair(address reader, address token, uint256 totalSupply);

    constructor() Ownable(msg.sender) {
        // TODO make this dynamic with hardhat and Ownable
    }

    function verifyReserves(
        IWeb2Json.Proof calldata jsonProof,
        IEVMTransaction.Proof[] calldata transactionProofs
    ) external returns (bool) {
        uint256 claimedReserves = readReserves(jsonProof);

        uint256 totalTokenReserves = 0;
        for (uint256 i = 0; i < transactionProofs.length; i++) {
            totalTokenReserves += readReserves(transactionProofs[i]);
        }
        debugTokenReserves = totalTokenReserves;

        return totalTokenReserves <= (claimedReserves * 1 ether);
    }

    function updateAddress(
        address readerAddress,
        address tokenAddress
    ) public onlyOwner {
        tokenStateReaders[readerAddress] = tokenAddress;
    }

    function abiSignatureHack(DataTransportObject calldata dto) public pure {}

    function readReserves(
        IWeb2Json.Proof calldata proof
    ) private returns (uint256) {
        require(isValidProof(proof), "Invalid json proof");
        DataTransportObject memory data = abi.decode(
            proof.data.responseBody.abiEncodedData,
            (DataTransportObject)
        );
        debugClaimedReserves = data.reserves;

        return data.reserves;
    }

    function readReserves(
        IEVMTransaction.Proof calldata proof
    ) private returns (uint256) {
        require(isValidProof(proof), "Invalid transaction proof");
        uint256 totalSupply = 0;
        for (uint256 i = 0; i < proof.data.responseBody.events.length; i++) {
            IEVMTransaction.Event memory _event = proof
                .data
                .responseBody
                .events[i];
            address readerAddress = _event.emitterAddress;
            (address tokenAddress, uint256 supply) = abi.decode(
                _event.data,
                (address, uint256)
            );
            bool correctTokenAndReaderAddress = tokenStateReaders[
                readerAddress
            ] == tokenAddress;
            if (correctTokenAndReaderAddress) {
                totalSupply += supply;
                emit GoodPair(readerAddress, tokenAddress, supply);
            } else {
                emit BadPair(readerAddress, tokenAddress, supply);
            }
        }
        return totalSupply;
    }

    function isValidProof(
        IWeb2Json.Proof calldata proof
    ) private view returns (bool) {
        return ContractRegistry.getFdcVerification().verifyJsonApi(proof);
    }

    function isValidProof(
        IEVMTransaction.Proof calldata proof
    ) private view returns (bool) {
        return
            ContractRegistry.getFdcVerification().verifyEVMTransaction(proof);
    }
}
