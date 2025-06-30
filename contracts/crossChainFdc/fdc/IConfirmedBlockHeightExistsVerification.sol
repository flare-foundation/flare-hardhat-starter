// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6 <0.9;

import "@flarenetwork/flare-periphery-contracts/coston2/IConfirmedBlockHeightExists.sol";

interface IConfirmedBlockHeightExistsVerification {
    function verifyConfirmedBlockHeightExists(
        IConfirmedBlockHeightExists.Proof calldata _proof
    ) external payable returns (bool _proved);
}
