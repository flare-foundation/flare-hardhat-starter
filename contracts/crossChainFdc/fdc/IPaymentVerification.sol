// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6 <0.9;

import "@flarenetwork/flare-periphery-contracts/coston2/IPayment.sol";

interface IPaymentVerification {
    function verifyPayment(
        IPayment.Proof calldata _proof
    ) external payable returns (bool _proved);
}
