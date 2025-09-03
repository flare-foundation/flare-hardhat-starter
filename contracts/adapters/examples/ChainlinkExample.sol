// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title AssetVault
 * @notice A simple vault for borrowing a synthetic stablecoin (MUSD) against native token collateral.
 * @dev This contract uses a Chainlink-compatible price feed
 * to value collateral. It also acts as the ERC20 token for MUSD.
 */
contract AssetVault is ERC20 {
    // --- State Variables ---

    // The Chainlink-compatible price feed for the collateral asset.
    AggregatorV3Interface public immutable priceFeed;

    // Mapping of user addresses to their deposited collateral amount in wei.
    mapping(address => uint256) public collateral;

    // The Loan-to-Value (LTV) ratio, as a percentage.
    // e.g., 50 means a user can borrow up to 50% of their collateral's value.
    uint256 public constant LOAN_TO_VALUE_RATIO = 50;

    // --- Errors ---
    error InsufficientCollateral();
    error NothingToWithdraw();
    error LoanNotRepaid();
    error AmountIsZero();

    // --- Events ---
    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event LoanBorrowed(address indexed user, uint256 amount);
    event LoanRepaid(address indexed user, uint256 amount);

    constructor(address _priceFeedAddress) ERC20("Mock USD", "MUSD") {
        priceFeed = AggregatorV3Interface(_priceFeedAddress);
    }

    // --- Core Functions ---

    /**
     * @notice Deposits the sent native tokens as collateral for the sender.
     */
    function deposit() external payable {
        if (msg.value == 0) revert AmountIsZero();
        collateral[msg.sender] += msg.value;
        emit CollateralDeposited(msg.sender, msg.value);
    }

    /**
     * @notice Allows a user to borrow MUSD against their deposited collateral.
     * @param _amount The amount of MUSD to borrow (with 18 decimals).
     */
    function borrow(uint256 _amount) external {
        if (_amount == 0) revert AmountIsZero();

        uint256 userCollateralValue = getCollateralValueInUsd(msg.sender);
        // The total debt will be their current MUSD balance plus the new amount.
        uint256 totalDebt = balanceOf(msg.sender) + _amount;

        // Calculate the maximum borrowable amount based on LTV.
        uint256 maxBorrowableUsd = (userCollateralValue * LOAN_TO_VALUE_RATIO) /
            100;

        if (totalDebt > maxBorrowableUsd) revert InsufficientCollateral();

        _mint(msg.sender, _amount);
        emit LoanBorrowed(msg.sender, _amount);
    }

    /**
     * @notice Repays a portion of the user's MUSD loan. The user must first approve
     * this contract to spend their MUSD.
     * @param _amount The amount of MUSD to repay.
     */
    function repay(uint256 _amount) external {
        if (_amount == 0) revert AmountIsZero();

        // The user must have enough MUSD to repay.
        // This also implicitly checks that they have a loan.
        require(balanceOf(msg.sender) >= _amount, "Insufficient MUSD balance");

        _burn(msg.sender, _amount);
        emit LoanRepaid(msg.sender, _amount);
    }

    /**
     * @notice Withdraws a specified amount of the user's collateral.
     * @dev The user must have repaid their entire MUSD loan before withdrawing.
     * @param _amount The amount of collateral to withdraw in wei.
     */
    function withdraw(uint256 _amount) external {
        if (_amount == 0) revert AmountIsZero();
        if (balanceOf(msg.sender) > 0) revert LoanNotRepaid();
        if (collateral[msg.sender] < _amount) revert NothingToWithdraw();

        collateral[msg.sender] -= _amount;
        payable(msg.sender).transfer(_amount);

        emit CollateralWithdrawn(msg.sender, _amount);
    }

    // --- View Functions ---

    /**
     * @notice Calculates the total USD value of a user's collateral.
     * @param _user The address of the user.
     * @return The total value in USD, scaled by 18 decimals.
     */
    function getCollateralValueInUsd(
        address _user
    ) public view returns (uint256) {
        uint256 userCollateral = collateral[_user];
        if (userCollateral == 0) return 0;

        // Fetch the latest price data from the adapter.
        (, int256 price, , , ) = priceFeed.latestRoundData();
        uint8 feedDecimals = priceFeed.decimals();

        // The price is an integer, so we scale it up by 18 (our standard) and
        // scale it down by the feed's decimals to get a consistent value.
        // (collateralAmount * price * 10^18) / (10^18 * 10^feedDecimals)
        return (userCollateral * uint256(price)) / (10 ** feedDecimals);
    }
}
