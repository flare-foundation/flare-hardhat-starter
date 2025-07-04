// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6 <0.9;

import "@flarenetwork/flare-periphery-contracts/coston2/IBalanceDecreasingTransaction.sol";

interface IBalanceDecreasingTransactionVerification {
    function verifyBalanceDecreasingTransaction(
        IBalanceDecreasingTransaction.Proof calldata _proof
    ) external payable returns (bool _proved);
}
