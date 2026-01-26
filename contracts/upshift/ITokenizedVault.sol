// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.25;

interface ITokenizedVault {
    // Deposit Functions
    function deposit(address assetIn, uint256 amountIn, address receiverAddr) external returns (uint256 shares);
    function previewDeposit(
        address assetIn,
        uint256 amountIn
    ) external view returns (uint256 shares, uint256 amountInReferenceTokens);

    // Withdrawal Functions
    function instantRedeem(uint256 shares, address receiverAddr) external;
    function requestRedeem(
        uint256 shares,
        address receiverAddr
    ) external returns (uint256 claimableEpoch, uint256 year, uint256 month, uint256 day);
    function claim(
        uint256 year,
        uint256 month,
        uint256 day,
        address receiverAddr
    ) external returns (uint256 shares, uint256 assetsAfterFee);
    function previewRedemption(
        uint256 shares,
        bool isInstant
    ) external view returns (uint256 assetsAmount, uint256 assetsAfterFee);

    // View Functions
    function asset() external view returns (address);
    function lpTokenAddress() external view returns (address);
    function withdrawalsPaused() external view returns (bool);
    function maxWithdrawalAmount() external view returns (uint256);
    function instantRedemptionFee() external view returns (uint256);
    function lagDuration() external view returns (uint256);
    function withdrawalFee() external view returns (uint256);
    function getWithdrawalEpoch()
        external
        view
        returns (uint256 year, uint256 month, uint256 day, uint256 claimableEpoch);
    function getBurnableAmountByReceiver(
        uint256 year,
        uint256 month,
        uint256 day,
        address receiverAddr
    ) external view returns (uint256);
}
