// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "hardhat/console.sol";

contract Beatblock {
    address public owner;
    uint256 public nftPrice;
    uint256 public totalNFTs;
    uint256 public remainingNFTs;
    uint256 public nextTokenId;
    uint256[3] public prizeDistribution;  // Distribution percentages for 1st, 2nd, and 3rd place
    mapping(uint256 => address) public ticketOwners;  // Mapping of token IDs to owners
    mapping(address => uint256) public votes;  // Mapping of artist addresses to vote counts
    address[3] public winners;  // Addresses of the winning artists

    event TicketPurchased(address indexed buyer, uint256 indexed tokenId);
    event VoteCasted(address indexed voter, address indexed artist);
    event ContestFinalized(address[3] winners, uint256[3] prizes);

    constructor(uint256 _nftPrice, uint256 _totalNFTs, uint256[3] memory _prizeDistribution) {
        owner = msg.sender;
        nftPrice = _nftPrice;
        totalNFTs = _totalNFTs;
        remainingNFTs = _totalNFTs;
        prizeDistribution = _prizeDistribution;
    }

    modifier isOwner() {
        require(msg.sender == owner, "Not the Owner");
        _;
    }

    function buyTicket() public payable {
        require(msg.value >= nftPrice, "Insufficient ETH sent for ticket price");
        require(remainingNFTs > 0, "No more tickets available");

        ticketOwners[nextTokenId] = msg.sender;
        emit TicketPurchased(msg.sender, nextTokenId);

        nextTokenId++;
        remainingNFTs--;

        // Optional: Refund any excess payment
        if (msg.value > nftPrice) {
            payable(msg.sender).transfer(msg.value - nftPrice);
        }
    }

    function castVote(address artist) public {
        require(ticketOwners[nextTokenId - 1] == msg.sender, "You do not own a ticket");
        require(votes[msg.sender] == 0, "You have already voted");

        votes[artist]++;
        emit VoteCasted(msg.sender, artist);
    }

    function finalizeContest() public isOwner {
        // Implement logic to determine the top 3 artists based on the votes and assign them to the winners array
        // ...

        uint256 totalPrize = nftPrice * totalNFTs;
        uint256[3] memory prizes = [
            (totalPrize * prizeDistribution[0]) / 100,
            (totalPrize * prizeDistribution[1]) / 100,
            (totalPrize * prizeDistribution[2]) / 100
        ];

        payable(winners[0]).transfer(prizes[0]);
        payable(winners[1]).transfer(prizes[1]);
        payable(winners[2]).transfer(prizes[2]);

        emit ContestFinalized(winners, prizes);
    }

    receive() external payable {}
}
