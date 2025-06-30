// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6 <0.9;

import "@flarenetwork/flare-periphery-contracts/coston2/IEVMTransaction.sol";

interface IEVMTransactionVerification {
    function verifyEVMTransaction(
        IEVMTransaction.Proof calldata _proof
    ) external payable returns (bool _proved);
}
