// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import {IFtsoRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ftso/userInterfaces/IFtsoRegistry.sol";

import {FlareContractsRegistryLibrary} from "@flarenetwork/flare-periphery-contracts/coston2/util-contracts/ContractRegistryLibrary.sol";

contract CoinFuture {
    event FutureProposed(
        uint256 indexed futureId,
        address proposer,
        address counterparty,
        uint256 expiration,
        string indexed token,
        uint256 targetPrice,
        uint256 amount,
        uint256 odds
    );

    event FutureAccepted(uint256 indexed futureId, address counterparty);

    event FutureSettled(
        uint256 indexed futureId,
        address winner,
        uint256 payout
    );

    struct Future {
        address proposer;
        address counterparty;
        uint256 expiration;
        string token;
        uint256 targePrice; // in 10**18 decimals
        uint256 amount;
        uint256 odds; // 1/ods in Bips, the payout is amount * (1 + 100/bips)
        bool isSettled;
    }

    address public immutable owner;
    Future[] public futures;
    uint256 constant ACCEPTANCE_WINDOW = 2 minutes;

    constructor() {
        owner = msg.sender;
    }

    function calculateFuturePayout(
        uint256 futureId
    ) public view returns (uint256 payout) {
        Future storage future = futures[futureId];

        return future.amount + (future.amount * 100) / future.odds;
    }

    function proposeFuture(
        uint256 expiration,
        string memory token,
        uint256 targetPrice,
        uint256 odds
    ) public payable {
        uint256 futureId = futures.length;
        futures.push(
            Future({
                proposer: msg.sender,
                counterparty: address(0),
                expiration: expiration,
                token: token,
                targePrice: targetPrice,
                amount: msg.value,
                odds: odds,
                isSettled: false
            })
        );

        emit FutureProposed(
            futureId,
            msg.sender,
            address(0),
            expiration,
            token,
            targetPrice,
            msg.value,
            odds
        );
    }

    function acceptFuture(uint256 futureId) public payable {
        Future storage future = futures[futureId];
        require(future.counterparty == address(0), "already accepted");
        require(future.proposer != msg.sender, "cannot accept own future");
        require(
            future.expiration > block.timestamp + ACCEPTANCE_WINDOW,
            "future expired"
        );

        uint256 price = calculateFuturePayout(futureId);
        require(msg.value >= price - future.amount, "wrong price");
        future.counterparty = msg.sender;

        emit FutureAccepted(futureId, msg.sender);

        if (msg.value > price - future.amount) {
            payable(msg.sender).transfer(msg.value - (price - future.amount));
        }
    }

    function settleFuture(uint256 futureId) public returns (address winner) {
        Future storage future = futures[futureId];
        require(!future.isSettled, "already settled");
        require(future.expiration < block.timestamp, "future not expired");
        future.isSettled = true;

        uint256 payout = calculateFuturePayout(futureId);

        // Get winner
        IFtsoRegistry ftsoRegistry = FlareContractsRegistryLibrary
            .getFtsoRegistry();

        (uint256 tokenPrice, , uint256 decimals) = ftsoRegistry
            .getCurrentPriceWithDecimals(future.token);

        uint256 tokenPriceWei = (10 ** (18 - decimals)) * tokenPrice;

        if (tokenPriceWei >= future.targePrice) {
            winner = future.proposer;
        } else {
            winner = future.counterparty;
        }

        emit FutureSettled(futureId, winner, payout);
        payable(winner).transfer(payout);
        return winner;
    }
}
