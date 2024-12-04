// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IEVMTransactionVerification} from "@flarenetwork/flare-periphery-contracts/coston/IEVMTransactionVerification.sol";
import {EVMTransaction} from "@flarenetwork/flare-periphery-contracts/coston/EVMTransaction.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston/ContractRegistry.sol";

struct EventInfo {
    address sender;
    uint256 value;
    bytes data;
}

struct TransactionInfo {
    EVMTransaction.Proof originalTransaction;
    uint256 eventNumber;
    EventInfo[] eventInfo;
}

contract EthereumPaymentCollector {
    TransactionInfo[] public transactions;

    function isEVMTransactionProofValid(
        EVMTransaction.Proof calldata transaction
    ) public view returns (bool) {
        // Use the library to get the verifier contract and verify that this transaction was proved by state connector
        return
            ContractRegistry
                .auxiliaryGetIEVMTransactionVerification()
                .verifyEVMTransaction(transaction);
    }

    function collectPayment(
        EVMTransaction.Proof calldata _transaction
    ) external {
        require(
            isEVMTransactionProofValid(_transaction),
            "Invalid transaction proof"
        );

        uint256 transactionIndex = transactions.length;
        transactions.push();
        transactions[transactionIndex].originalTransaction = _transaction;
        transactions[transactionIndex].eventNumber = _transaction
            .data
            .responseBody
            .events
            .length;
        EventInfo[] storage eventInfo = transactions[transactionIndex]
            .eventInfo;
        for (
            uint256 i = 0;
            i < _transaction.data.responseBody.events.length;
            i++
        ) {
            // Decode each event
            (address sender, uint256 value, bytes memory data) = abi.decode(
                _transaction.data.responseBody.events[i].data,
                (address, uint256, bytes)
            );
            eventInfo.push(
                EventInfo({sender: sender, value: value, data: data})
            );
        }
    }

    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }

    function getAllTransactions()
        external
        view
        returns (TransactionInfo[] memory)
    {
        TransactionInfo[] memory result = new TransactionInfo[](
            transactions.length
        );
        for (uint256 i = 0; i < transactions.length; i++) {
            result[i] = transactions[i];
        }
        return result;
    }
}
