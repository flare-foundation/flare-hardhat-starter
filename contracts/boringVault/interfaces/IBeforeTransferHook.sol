// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IBeforeTransferHook {
    function beforeTransfer(
        address from,
        address to,
        address operator
    ) external view;
}
