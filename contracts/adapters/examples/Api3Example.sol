// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;
import {FtsoApi3AdapterBase} from "../Api3Adapter.sol";

/**
 * @title PriceGuesser
 * @notice A simple prediction market where users bet on a future asset price.
 * @dev This contract uses an API3-compatible price feed to settle the market.
 * All bets are made in the native network token (e.g., C2FLR).
 */
contract PriceGuesser is FtsoApi3AdapterBase {
    // --- State Variables ---

    uint256 public immutable strikePrice; // The target price (with 18 decimals).
    uint256 public immutable expiryTimestamp; // When the betting round ends.

    // Total funds in each betting pool.
    uint256 public totalBetsAbove;
    uint256 public totalBetsBelow;

    // Mapping of user bets for each pool.
    mapping(address => uint256) public betsAbove;
    mapping(address => uint256) public betsBelow;

    // The final outcome of the market.
    enum Outcome {
        Unsettled,
        Above,
        Below
    }
    Outcome public outcome;

    // Tracks if a user has already claimed their winnings.
    mapping(address => bool) public hasClaimed;

    // --- Errors ---
    error BettingIsClosed();
    error RoundNotSettledYet();
    error RoundAlreadySettled();
    error NothingToClaim();
    error AmountIsZero();

    // --- Events ---
    event BetPlaced(address indexed user, bool isBetAbove, uint256 amount);
    event MarketSettled(Outcome outcome, int256 finalPrice);
    event WinningsClaimed(address indexed user, uint256 amount);

    constructor(
        bytes21 _ftsoFeedId,
        string memory _description,
        uint256 _maxAgeSeconds,
        uint256 _strikePrice,
        uint256 _durationSeconds
    ) FtsoApi3AdapterBase(_ftsoFeedId, _description, _maxAgeSeconds) {
        strikePrice = _strikePrice;
        expiryTimestamp = block.timestamp + _durationSeconds;
    }

    // --- Public Refresh Function ---
    function _refresh() external {
        this.refresh();
    }

    // --- User Functions ---

    /**
     * @notice Places a bet that the asset price will be >= the strike price at expiry.
     */
    function betAbove() external payable {
        if (block.timestamp >= expiryTimestamp) revert BettingIsClosed();
        if (msg.value == 0) revert AmountIsZero();

        betsAbove[msg.sender] += msg.value;
        totalBetsAbove += msg.value;
        emit BetPlaced(msg.sender, true, msg.value);
    }

    /**
     * @notice Places a bet that the asset price will be < the strike price at expiry.
     */
    function betBelow() external payable {
        if (block.timestamp >= expiryTimestamp) revert BettingIsClosed();
        if (msg.value == 0) revert AmountIsZero();

        betsBelow[msg.sender] += msg.value;
        totalBetsBelow += msg.value;
        emit BetPlaced(msg.sender, false, msg.value);
    }

    /**
     * @notice Settles the market by reading the final price from the oracle.
     * @dev Anyone can call this after the expiry timestamp has passed.
     */
    function settle() external {
        if (block.timestamp < expiryTimestamp) revert RoundNotSettledYet();
        if (outcome != Outcome.Unsettled) revert RoundAlreadySettled();

        // Read the price from the FtsoApi3Adapter.
        (int224 finalPrice, ) = this.read();

        // Determine the outcome.
        if (int256(finalPrice) >= int256(strikePrice)) {
            outcome = Outcome.Above;
        } else {
            outcome = Outcome.Below;
        }

        emit MarketSettled(outcome, finalPrice);
    }

    /**
     * @notice Allows a winning user to claim their share of the prize pool.
     */
    function claimWinnings() external {
        if (outcome == Outcome.Unsettled) revert RoundNotSettledYet();
        if (hasClaimed[msg.sender]) revert NothingToClaim();

        uint256 winnings = 0;

        if (outcome == Outcome.Above) {
            // User wins if they bet in the "Above" pool.
            uint256 userBet = betsAbove[msg.sender];
            if (userBet > 0 && totalBetsAbove > 0) {
                // Winnings = (userBet / totalWinningPool) * totalLosingPool
                winnings = (userBet * totalBetsBelow) / totalBetsAbove;
                // Add their original bet back.
                winnings += userBet;
            }
        } else {
            // outcome == Outcome.Below
            // User wins if they bet in the "Below" pool.
            uint256 userBet = betsBelow[msg.sender];
            if (userBet > 0 && totalBetsBelow > 0) {
                winnings = (userBet * totalBetsAbove) / totalBetsBelow;
                winnings += userBet;
            }
        }

        if (winnings == 0) revert NothingToClaim();

        hasClaimed[msg.sender] = true;
        payable(msg.sender).transfer(winnings);
        emit WinningsClaimed(msg.sender, winnings);
    }
}
