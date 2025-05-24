// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IEVMTransaction} from "@flarenetwork/flare-periphery-contracts/coston2/IEVMTransaction.sol";
import {IFdcVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IFdcVerification.sol";
import {MyNFT} from "contracts/crossChainPayment/NFT.sol";

struct TokenTransfer {
    address from;
    address to;
    uint256 value;
}

interface INFTMinter {
    function collectAndProcessTransferEvents(
        IEVMTransaction.Proof calldata _transaction
    ) external;
}

contract NFTMinter is INFTMinter {
    // USDC contract address on sepolia
    address public constant USDC_CONTRACT =
        0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    // Our address on Sepolia
    address public constant OWNER = 0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD;

    MyNFT public token;
    TokenTransfer[] public tokenTransfers;
    mapping(bytes32 => bool) public processedTransactions;

    event NFTMinted(address owner, uint256 tokenId);

    constructor(MyNFT _token) {
        token = _token;
    }

    function collectAndProcessTransferEvents(
        IEVMTransaction.Proof calldata _transaction
    ) external {
        bytes32 transactionHash = _transaction.data.requestBody.transactionHash;
        require(
            !processedTransactions[transactionHash],
            "Transaction already processed"
        );

        // Check that this EVMTransaction has indeed been confirmed by the FDC
        require(
            isEVMTransactionProofValid(_transaction),
            "Invalid transaction proof"
        );

        // Mark this transaction as processed
        processedTransactions[
            _transaction.data.requestBody.transactionHash
        ] = true;

        // Go through all events
        for (
            uint256 i = 0;
            i < _transaction.data.responseBody.events.length;
            i++
        ) {
            // Get current event
            IEVMTransaction.Event memory _event = _transaction
                .data
                .responseBody
                .events[i];

            // Disregard events that are not from the USDC contract
            if (_event.emitterAddress != USDC_CONTRACT) {
                continue;
            }

            // Disregard non Transfer events
            if (
                // The topic0 doesn't match the Transfer event
                _event.topics.length == 0 || // No topics
                _event.topics[0] !=
                keccak256(abi.encodePacked("Transfer(address,address,uint256)"))
            ) {
                continue;
            }

            // We now know that this is a Transfer event from the USDC contract - and therefore know how to decode
            // the topics and data
            // Topic 1 is the sender
            address sender = address(uint160(uint256(_event.topics[1])));
            // Topic 2 is the receiver
            address receiver = address(uint160(uint256(_event.topics[2])));
            // Data is the amount
            uint256 value = abi.decode(_event.data, (uint256));

            // Disregard transfers that are not payments of at least 3000 to the owner
            if (receiver != OWNER || value < 3000) {
                continue;
            }

            tokenTransfers.push(
                TokenTransfer({from: sender, to: receiver, value: value})
            );
            uint256 tokenId = token.safeMint(sender);
            emit NFTMinted(sender, tokenId);
        }
    }

    function getTokenTransfers()
        external
        view
        returns (TokenTransfer[] memory)
    {
        TokenTransfer[] memory result = new TokenTransfer[](
            tokenTransfers.length
        );
        for (uint256 i = 0; i < tokenTransfers.length; i++) {
            result[i] = tokenTransfers[i];
        }
        return result;
    }

    function isEVMTransactionProofValid(
        IEVMTransaction.Proof calldata transaction
    ) public view returns (bool) {
        // Use the library to get the verifier contract and verify that this transaction was proved by state connector
        IFdcVerification fdc = ContractRegistry.getFdcVerification();
        // return true;
        return fdc.verifyEVMTransaction(transaction);
    }
}
