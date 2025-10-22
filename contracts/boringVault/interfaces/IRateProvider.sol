// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IRateProvider {
    function getRate() external view returns (uint256);
}
