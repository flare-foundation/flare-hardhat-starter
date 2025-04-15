// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IEVMTransaction} from "@flarenetwork/flare-periphery-contracts/coston/IEVMTransaction.sol";
import {IJsonApi} from "@flarenetwork/flare-periphery-contracts/coston/IJsonApi.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston/ContractRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

struct DataTransportObject {
    uint256 reserves;
}

contract ProofOfReserves is Ownable {
    // Two events and values for debug purposes
    event GoodPair(address reader, address token, uint256 totalSupply);
    event BadPair(address reader, address token, uint256 totalSupply);

    uint256 public debugTokenReserves = 0;
    uint256 public debugClaimedReserves = 0;

    mapping(address => address) public tokenStateReaders;

    constructor() Ownable(msg.sender) {
        // TODO make this dynamic with hardhat and Ownable
    }

    function updateAddress(address readerAddress, address tokenAddress) public onlyOwner {
        tokenStateReaders[readerAddress] = tokenAddress;
    }

    function verifyReserves(IJsonApi.Proof calldata jsonProof, IEVMTransaction.Proof[] calldata transactionProofs)
        external
        returns (bool)
    {
        uint256 claimedReserves = readReserves(jsonProof);

        uint256 totalTokenReserves = 0;
        for (uint256 i = 0; i < transactionProofs.length; i++) {
            totalTokenReserves += readReserves(transactionProofs[i]);
        }
        debugTokenReserves = totalTokenReserves;

        return totalTokenReserves <= (claimedReserves * 1 ether);
    }

    function readReserves(IJsonApi.Proof calldata proof) private returns (uint256) {
        require(isValidProof(proof), "Invalid json proof");
        DataTransportObject memory data = abi.decode(proof.data.responseBody.abi_encoded_data, (DataTransportObject));
        debugClaimedReserves = data.reserves;

        return data.reserves;
    }

    function readReserves(IEVMTransaction.Proof calldata proof) private returns (uint256) {
        require(isValidProof(proof), "Invalid transaction proof");
        uint256 totalSupply = 0;
        for (uint256 i = 0; i < proof.data.responseBody.events.length; i++) {
            IEVMTransaction.Event memory _event = proof.data.responseBody.events[i];
            address readerAddress = _event.emitterAddress;
            (address tokenAddress, uint256 supply) = abi.decode(_event.data, (address, uint256));
            bool correctTokenAndReaderAddress = tokenStateReaders[readerAddress] == tokenAddress;
            if (correctTokenAndReaderAddress) {
                totalSupply += supply;
                emit GoodPair(readerAddress, tokenAddress, supply);
            } else {
                emit BadPair(readerAddress, tokenAddress, supply);
            }
        }
        return totalSupply;
    }

    function isValidProof(IJsonApi.Proof calldata proof) private view returns (bool) {
        return ContractRegistry.auxiliaryGetIJsonApiVerification().verifyJsonApi(proof);
    }

    function isValidProof(IEVMTransaction.Proof calldata proof) private view returns (bool) {
        return ContractRegistry.getFdcVerification().verifyEVMTransaction(proof);
    }

    function abiSignatureHack(DataTransportObject calldata dto) external pure {}
}
