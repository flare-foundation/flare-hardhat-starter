// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6 <0.9;

import "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";

interface IWeb2JsonVerificationOther {
    function verifyWeb2Json(IWeb2Json.Proof calldata _proof) external payable returns (bool _proved);
}
