// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IEVMTransaction} from "@flarenetwork/flare-periphery-contracts/coston2/IEVMTransaction.sol";
import {IJsonApi} from "@flarenetwork/flare-periphery-contracts/coston2/IJsonApi.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

struct DataTransportObject {
    uint256 reserves;
}

contract ProofOfReserves {
    event GoodPair(address reader, address token, uint256 totalSupply);
    event BadPair(address reader, address token, uint256 totalSupply);

    mapping(address => address) public tokenStateReaders;

    // FIXME remove debug
    uint256 public debugTokenReserves = 0;
    uint256 public debugClaimedReserves = 0;

    constructor() {
        // TODO make this dynamic with hardhat and Ownable
        tokenStateReaders[0xa55ca3B48C3343f4eeC31433c4c9EEB6F806cF72] = 0x971C2CbD573e9aCbad555Fdd2252ab21eb73a962;
        tokenStateReaders[0x3A8E713ca13ea199D3eB49b1bE13dcD04bB1F810] = 0x1C57e92ca1d10403B1F425699fe629B439F68A12;
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
        // TODO ignore wrong events
        require(isValidProof(proof), "Invalid transaction proof");
        uint256 totalSupply = 0;
        // TODO
        for (uint256 i = 0; i < proof.data.responseBody.events.length; i++) {
            IEVMTransaction.Event memory _event = proof.data.responseBody.events[i];
            address readerAddress = proof.data.responseBody.sourceAddress;
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
        // return true;
        return ContractRegistry.auxiliaryGetIJsonApiVerification().verifyJsonApi(proof);
    }

    function isValidProof(IEVMTransaction.Proof calldata proof) private view returns (bool) {
        // return true;
        return ContractRegistry.getFdcVerification().verifyEVMTransaction(proof);
    }

    function abiSignatureHack(DataTransportObject calldata dto) external pure {}
}
