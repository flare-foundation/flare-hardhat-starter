// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

// Flare Network Imports
import {TestFtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

// Pyth Network Imports
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/**
 * @title FtsoPythAdapter
 * @notice Exposes Flare FTSOv2 prices through Pyth Network's IPyth interface.
 * @dev This contract adapts the data model of Flare's FTSO to Pyth's Price struct.
 * It implements a subset of the IPyth interface, specifically `getPriceNoOlderThan`
 * and `getPriceUnsafe`, and reverts on all other functions.
 */
abstract contract FtsoPythAdapterBase is IPyth {
    // ---- Immutable configuration ----
    bytes21 internal immutable ftsoFeedId; // e.g. "BTC/USD" => 0x014254432f555344...
    bytes32 internal immutable pythPriceId; // The Pyth-style price ID this adapter will serve.
    string internal descriptionText; // Human readable, e.g. "FTSOv2 BTC/USD (Coston2)"

    // ---- Cached state ----
    PythStructs.Price internal _latestPrice;

    // ---- Events ----
    event Refreshed(
        bytes21 indexed feedId,
        bytes32 indexed priceId,
        int64 price,
        int32 expo,
        uint publishTime
    );

    constructor(
        bytes21 _ftsoFeedId,
        bytes32 _pythPriceId,
        string memory _description
    ) {
        ftsoFeedId = _ftsoFeedId;
        pythPriceId = _pythPriceId;
        descriptionText = _description;
    }

    // --------- Pyth IPyth Interface Implementation ---------

    /**
     * @notice Gets the latest price data for the configured feed ID, ensuring it is not stale.
     * @dev This is the primary function for safely consuming prices from this adapter.
     * @param _id The Pyth price feed ID.
     * @param _age The maximum allowed age of the price in seconds.
     * @return The cached Price struct.
     */
    function getPriceNoOlderThan(
        bytes32 _id,
        uint _age
    ) public view virtual override returns (PythStructs.Price memory) {
        require(_id == pythPriceId, "INVALID_PRICE_ID");

        PythStructs.Price memory p = _latestPrice;
        require(p.publishTime != 0, "NO_DATA");
        require(block.timestamp - p.publishTime <= _age, "STALE_PRICE");

        return p;
    }

    /**
     * @notice Gets the latest price data without a staleness check.
     * @dev Use with caution. Check the publishTime of the returned struct.
     * @param _id The Pyth price feed ID.
     * @return The cached Price struct.
     */
    function getPriceUnsafe(
        bytes32 _id
    ) public view virtual override returns (PythStructs.Price memory) {
        require(_id == pythPriceId, "INVALID_PRICE_ID");
        require(_latestPrice.publishTime != 0, "NO_DATA");
        return _latestPrice;
    }

    // --------- Unsupported IPyth Functions ---------
    // @dev The following functions are part of the IPyth interface but are not
    // supported by this FTSO adapter. They will always revert.

    function getEmaPriceUnsafe(
        bytes32
    ) external view override returns (PythStructs.Price memory) {
        revert("UNSUPPORTED");
    }

    function getEmaPriceNoOlderThan(
        bytes32,
        uint
    ) external view override returns (PythStructs.Price memory) {
        revert("UNSUPPORTED");
    }

    function updatePriceFeeds(bytes[] calldata) external payable override {
        revert("UNSUPPORTED");
    }

    function updatePriceFeedsIfNecessary(
        bytes[] calldata,
        bytes32[] calldata,
        uint64[] calldata
    ) external payable override {
        revert("UNSUPPORTED");
    }

    function getUpdateFee(
        bytes[] calldata
    ) external view override returns (uint) {
        revert("UNSUPPORTED");
    }

    function getTwapUpdateFee(
        bytes[] calldata
    ) external view override returns (uint) {
        revert("UNSUPPORTED");
    }

    function parsePriceFeedUpdates(
        bytes[] calldata,
        bytes32[] calldata,
        uint64,
        uint64
    ) external payable override returns (PythStructs.PriceFeed[] memory) {
        revert("UNSUPPORTED");
    }

    function parsePriceFeedUpdatesWithConfig(
        bytes[] calldata,
        bytes32[] calldata,
        uint64,
        uint64,
        bool,
        bool,
        bool
    )
        external
        payable
        override
        returns (PythStructs.PriceFeed[] memory, uint64[] memory)
    {
        revert("UNSUPPORTED");
    }

    function parseTwapPriceFeedUpdates(
        bytes[] calldata,
        bytes32[] calldata
    ) external payable override returns (PythStructs.TwapPriceFeed[] memory) {
        revert("UNSUPPORTED");
    }

    function parsePriceFeedUpdatesUnique(
        bytes[] calldata,
        bytes32[] calldata,
        uint64,
        uint64
    ) external payable override returns (PythStructs.PriceFeed[] memory) {
        revert("UNSUPPORTED");
    }

    // --------- Refresh path ---------

    /**
     * @notice Pulls fresh data from FTSOv2 and caches it in the Pyth Price format.
     * @dev Anyone can call this function to update the price.
     */
    function refresh() external {
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();

        (uint256 rawValue, int8 ftsoDecimals, uint64 ts) = ftsoV2.getFeedById(
            ftsoFeedId
        );
        require(ts != 0, "FTSO_NO_DATA");

        _latestPrice = PythStructs.Price({
            price: int64(uint64(rawValue)),
            conf: 0, // FTSO does not provide a confidence interval
            expo: -ftsoDecimals,
            publishTime: ts
        });

        emit Refreshed(
            ftsoFeedId,
            pythPriceId,
            _latestPrice.price,
            _latestPrice.expo,
            _latestPrice.publishTime
        );
    }

    // --------- Admin niceties (optional, non-critical) ---------

    function setDescription(string calldata newDesc) external {
        descriptionText = newDesc;
    }

    function latestPrice() external view returns (PythStructs.Price memory) {
        return _latestPrice;
    }
}
