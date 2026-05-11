// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ContractRegistry } from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import { IAssetManager } from "@flarenetwork/flare-periphery-contracts/coston2/IAssetManager.sol";
import { RandomNumberV2Interface } from "@flarenetwork/flare-periphery-contracts/coston2/RandomNumberV2Interface.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract Roulette is Ownable {
    using SafeERC20 for IERC20;

    enum BetKind {
        STRAIGHT,
        RED,
        BLACK,
        ODD,
        EVEN,
        LOW,
        HIGH
    }

    struct Bet {
        address player;
        BetKind kind;
        uint8 selection;
        uint128 amount;
        uint64 placedAt;
        bool settled;
    }

    // Bitmask of red wheel numbers on a standard European roulette wheel.
    uint256 private constant _RED_MASK =
        (uint256(1) << 1) |
            (uint256(1) << 3) |
            (uint256(1) << 5) |
            (uint256(1) << 7) |
            (uint256(1) << 9) |
            (uint256(1) << 12) |
            (uint256(1) << 14) |
            (uint256(1) << 16) |
            (uint256(1) << 18) |
            (uint256(1) << 19) |
            (uint256(1) << 21) |
            (uint256(1) << 23) |
            (uint256(1) << 25) |
            (uint256(1) << 27) |
            (uint256(1) << 30) |
            (uint256(1) << 32) |
            (uint256(1) << 34) |
            (uint256(1) << 36);

    IERC20 public immutable fxrp;
    RandomNumberV2Interface public immutable generator;

    mapping(address => uint256) public chips;
    mapping(uint256 => Bet) public bets;
    uint256 public nextBetId;

    uint256 public houseFunds;
    uint256 public outstandingMaxLoss;

    event ChipsBought(address indexed player, uint256 amount);
    event ChipsCashedOut(address indexed player, uint256 amount);
    event BetPlaced(uint256 indexed betId, address indexed player, BetKind kind, uint8 selection, uint256 amount);
    event BetSettled(uint256 indexed betId, uint8 wheel, bool won, uint256 payout);
    event HouseFunded(uint256 amount);
    event HouseWithdrawn(uint256 amount);

    error InvalidSelection();
    error InsufficientChips();
    error InsufficientHouseFunds();
    error BetAmountZero();
    error AlreadySettled();
    error RandomNotReady();

    constructor(address _initialOwner) Ownable(_initialOwner) {
        IAssetManager assetManager = ContractRegistry.getAssetManagerFXRP();
        fxrp = IERC20(address(assetManager.fAsset()));
        generator = ContractRegistry.getRandomNumberV2();
    }

    function buyChips(uint256 amount) external {
        if (amount == 0) revert BetAmountZero();
        fxrp.safeTransferFrom(msg.sender, address(this), amount);
        chips[msg.sender] += amount;
        emit ChipsBought(msg.sender, amount);
    }

    function cashOut(uint256 amount) external {
        if (chips[msg.sender] < amount) revert InsufficientChips();
        chips[msg.sender] -= amount;
        fxrp.safeTransfer(msg.sender, amount);
        emit ChipsCashedOut(msg.sender, amount);
    }

    function placeBet(BetKind kind, uint8 selection, uint128 amount) external returns (uint256 betId) {
        if (amount == 0) revert BetAmountZero();
        if (kind == BetKind.STRAIGHT) {
            if (selection > 36) revert InvalidSelection();
        }
        if (chips[msg.sender] < amount) revert InsufficientChips();

        uint256 payoutMultiplier = _payoutMultiplier(kind);
        uint256 maxLoss = uint256(amount) * payoutMultiplier;
        if (houseFunds < outstandingMaxLoss + maxLoss) revert InsufficientHouseFunds();

        chips[msg.sender] -= amount;
        outstandingMaxLoss += maxLoss;

        betId = nextBetId++;
        bets[betId] = Bet({
            player: msg.sender,
            kind: kind,
            selection: selection,
            amount: amount,
            placedAt: uint64(block.timestamp),
            settled: false
        });
        emit BetPlaced(betId, msg.sender, kind, selection, amount);
    }

    function settleBet(uint256 betId) external {
        Bet storage bet = bets[betId];
        if (bet.settled) revert AlreadySettled();

        (uint256 randomNumber, bool isSecureRandom, uint256 randomTimestamp) = generator.getRandomNumber();
        if (!isSecureRandom || randomTimestamp <= bet.placedAt) revert RandomNotReady();

        uint8 wheel = uint8(uint256(keccak256(abi.encode(randomNumber, betId))) % 37);
        bool won = _isWinningWheel(wheel, bet.kind, bet.selection);

        uint256 payoutMultiplier = _payoutMultiplier(bet.kind);
        uint256 maxLoss = uint256(bet.amount) * payoutMultiplier;
        outstandingMaxLoss -= maxLoss;

        uint256 payout = 0;
        if (won) {
            payout = uint256(bet.amount) + maxLoss;
            chips[bet.player] += payout;
            houseFunds -= maxLoss;
        } else {
            houseFunds += uint256(bet.amount);
        }

        bet.settled = true;
        emit BetSettled(betId, wheel, won, payout);
    }

    function fundHouse(uint256 amount) external onlyOwner {
        if (amount == 0) revert BetAmountZero();
        fxrp.safeTransferFrom(msg.sender, address(this), amount);
        houseFunds += amount;
        emit HouseFunded(amount);
    }

    function withdrawHouse(uint256 amount) external onlyOwner {
        if (houseFunds < amount + outstandingMaxLoss) revert InsufficientHouseFunds();
        houseFunds -= amount;
        fxrp.safeTransfer(msg.sender, amount);
        emit HouseWithdrawn(amount);
    }

    function _payoutMultiplier(BetKind kind) private pure returns (uint256) {
        if (kind == BetKind.STRAIGHT) return 35;
        return 1;
    }

    function _isWinningWheel(uint8 wheel, BetKind kind, uint8 selection) private pure returns (bool) {
        if (kind == BetKind.STRAIGHT) return wheel == selection;
        if (wheel == 0) return false;
        if (kind == BetKind.RED) return ((_RED_MASK >> wheel) & 1) == 1;
        if (kind == BetKind.BLACK) return ((_RED_MASK >> wheel) & 1) == 0;
        if (kind == BetKind.ODD) return wheel % 2 == 1;
        if (kind == BetKind.EVEN) return wheel % 2 == 0;
        if (kind == BetKind.LOW) return wheel <= 18;
        return wheel >= 19;
    }
}
