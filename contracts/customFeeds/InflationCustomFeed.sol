// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ContractRegistry } from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import { IWeb2Json } from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";
import { IICustomFeed } from "@flarenetwork/flare-periphery-contracts/coston2/customFeeds/interfaces/IICustomFeed.sol";

/**
 * @title InflationCustomFeed
 * @notice Custom feed for inflation data (e.g., US CPI Annual), with on-chain FDC verification using Web2Json.
 * @dev Implements the IICustomFeed interface. This version does not have ownership functionality.
 */
contract InflationCustomFeed is IICustomFeed {
    // --- State Variables ---

    struct InflationData {
        uint256 inflationRate;
        uint256 observationYear;
    }

    bytes21 public feedIdentifier;
    string public name; // e.g., "US_INFLATION_CPI_ANNUAL"
    int8 public constant DECIMALS = 4;

    InflationData public latestInflationData;
    uint64 public latestVerifiedTimestamp;

    // --- Events ---
    event InflationDataVerified(
        string indexed feedName,
        uint256 inflationRate,
        uint256 observationYear,
        uint64 verificationTimestamp,
        string apiUrl
    );

    // --- Errors ---
    error InvalidFeedId();
    error InvalidName();

    /**
     * @param _feedId The unique identifier for this feed (bytes21, typically 0x21 + first 20 bytes
     *        of a string hash like "INFLATION/US_INFLATION_CPI_ANNUAL").
     * @param _name A descriptive name for the feed, corresponding to the dataset identifier from
     *        the script (e.g., "US_INFLATION_CPI_ANNUAL").
     */
    constructor(bytes21 _feedId, string memory _name) {
        if (_feedId == bytes21(0)) revert InvalidFeedId();
        if (bytes(_name).length == 0) revert InvalidName();

        feedIdentifier = _feedId;
        name = _name;
    }

    // --- FDC Verification Logic ---

    /**
     * @notice Verifies inflation data proof obtained via FDC Web2Json attestation and stores the data.
     * @dev This function is public. It performs on-chain FDC verification.
     * @param _proof The IWeb2Json.Proof data structure containing the attestation and response.
     */
    function verifyInflationData(IWeb2Json.Proof calldata _proof) external {
        // 1. FDC Verification using the ContractRegistry for Web2Json
        require(ContractRegistry.getFdcVerification().verifyWeb2Json(_proof), "FDC: Invalid Web2Json proof");

        // 2. Decode Inflation Data from the proof's response body
        InflationData memory newInflationData = abi.decode(_proof.data.responseBody.abiEncodedData, (InflationData));

        // 3. Store verified data and timestamp
        latestInflationData = newInflationData;
        latestVerifiedTimestamp = uint64(block.timestamp);

        // 4. Emit event
        emit InflationDataVerified(
            name,
            newInflationData.inflationRate,
            newInflationData.observationYear,
            latestVerifiedTimestamp,
            _proof.data.requestBody.url
        );
    }

    // --- Custom Feed Interface (IICustomFeed) Implementation ---

    /**
     * @notice Gets the latest verified inflation rate, its decimals, and the on-chain verification timestamp.
     * @inheritdoc IICustomFeed
     */
    function getCurrentFeed() external payable override returns (uint256 _value, int8 _decimals, uint64 _timestamp) {
        _value = latestInflationData.inflationRate;
        _decimals = DECIMALS;
        _timestamp = latestVerifiedTimestamp;
    }

    /**
     * @notice Returns the feed identifier.
     * @inheritdoc IICustomFeed
     */
    function feedId() external view override returns (bytes21 _feedId) {
        _feedId = feedIdentifier;
    }

    // --- Additional View Functions ---

    /**
     * @notice Provides a combined view of the latest inflation rate and its decimals.
     * Useful for off-chain systems to understand how to interpret the value.
     */
    function getFeedDataView()
        external
        view
        returns (uint256 _value, int8 _decimals, uint256 _observationYear, uint64 _verifiedTimestamp)
    {
        _value = latestInflationData.inflationRate;
        _decimals = DECIMALS;
        _observationYear = latestInflationData.observationYear;
        _verifiedTimestamp = latestVerifiedTimestamp;
    }

    /**
     * @notice Calculates the fee for calling getCurrentFeed. Returns 0 for this feed.
     * @inheritdoc IICustomFeed
     */
    function calculateFee() external pure override returns (uint256 _fee) {
        return 0;
    }

    /**
     * @notice Returns the latest verified inflation rate.
     * @dev The value is scaled by 10^DECIMALS.
     */
    function read() public view returns (uint256 value) {
        return latestInflationData.inflationRate;
    }

    /**
     * @notice Returns the number of decimals for the inflation rate value.
     * @dev This indicates that the stored `inflationRate` should be divided by 10^DECIMALS to get the actual rate.
     */
    function decimals() public pure returns (int8) {
        return DECIMALS;
    }
}
