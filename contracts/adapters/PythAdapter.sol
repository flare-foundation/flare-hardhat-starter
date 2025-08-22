// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {TestFtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
/**
 * @title IPyth
 * @notice Interface for the Pyth Network's price feed contract.
 * @dev This is a partial interface containing only the necessary structs and functions
 * for this adapter. For the full interface, see the Pyth Network documentation: https://docs.pyth.network/developers/price-api
 */
interface IPyth {
    /**
     * @notice A price with a confidence interval and other metadata.
     * @param price The price, represented as a signed 64-bit integer.
     * @param conf The confidence interval, represented as an unsigned 64-bit integer.
     * @param expo The exponent for the price. The real value is price * 10^expo.
     * @param publishTime The timestamp of the price update.
     */
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint publishTime;
    }

    /**
     * @notice Get the current price for a price feed.
     * @param id The ID of the price feed to query.
     * @return price The current price struct for the given price feed ID.
     */
    function getPrice(bytes32 id) external view returns (Price memory price);

    /**
     * @notice Get the exponentially-weighted moving average price for a price feed.
     * @param id The ID of the price feed to query.
     * @return price The current EMA price struct for the given price feed ID.
     */
    function getEmaPrice(bytes32 id) external view returns (Price memory price);
}

/**
 * @title FtsoPythAdapter
 * @notice Exposes Flare FTSOv2 prices through Pyth Network's IPyth interface.
 *
 * @dev This contract adapts the data model of Flare's FTSO to Pyth's Price struct.
 * - FTSO provides a `value` and `decimals`.
 * - Pyth uses a `price` and an `expo` (exponent), where the real value is `price * 10^expo`.
 * - This adapter represents the FTSO price by setting `price = value` and `expo = -decimals`.
 * - FTSO does not provide a confidence interval, so `conf` is set to 0.
 *
 * IMPORTANT:
 * - Pyth's `getPrice()` is view, but FTSOv2 may require a fee to read. We are using
 * TestFtsoV2Interface which does not require a fee.
 * - We therefore cache the latest price in storage via `refresh()`, and
 * `getPrice()` returns the cached value.
 *
 * Usage:
 * - Anyone (or your keeper) calls refresh().
 * - Pyth-integrated consumers keep calling getPrice().
 */
contract FtsoPythAdapter is IPyth {
    // ---- Immutable configuration ----
    bytes21 public immutable ftsoFeedId; // e.g. "BTC/USD" => 0x014254432f555344...
    bytes32 public immutable pythPriceId; // The Pyth-style price ID this adapter will serve.
    string public descriptionText; // Human readable, e.g. "FTSOv2 BTC/USD (Coston2)"
    uint256 public immutable maxAgeSeconds; // Staleness guard for cached price

    // ---- Cached state ----
    Price private _latestPrice;

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
        string memory _description,
        uint256 _maxAgeSeconds
    ) {
        ftsoFeedId = _ftsoFeedId;
        pythPriceId = _pythPriceId;
        descriptionText = _description;
        maxAgeSeconds = _maxAgeSeconds;
    }

    // --------- Pyth IPyth Interface ---------

    /**
     * @notice Gets the latest price data for the configured feed ID.
     * @dev Checks for a valid Pyth price ID and that the cached data is not stale.
     * @param _id The Pyth price feed ID.
     * @return The cached Price struct.
     */
    function getPrice(
        bytes32 _id
    ) external view override returns (Price memory) {
        require(_id == pythPriceId, "INVALID_PRICE_ID");

        Price memory p = _latestPrice;
        require(p.publishTime != 0, "NO_DATA");

        // Optional staleness guard for consumers relying solely on this call
        if (maxAgeSeconds > 0) {
            require(block.timestamp - p.publishTime <= maxAgeSeconds, "STALE");
        }
        return p;
    }

    /**
     * @notice EMA price is not supported by the FTSO. This function will always revert.
     */
    function getEmaPrice(
        bytes32
    ) external pure override returns (Price memory) {
        revert("EMA_UNSUPPORTED");
    }

    // --------- Refresh path ---------

    /**
     * @notice Pulls fresh data from FTSOv2 and caches it in the Pyth Price format.
     * @dev Anyone can call this function to update the price.
     */
    function refresh() external {
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();

        // Read FTSO value (returns integer value, feed decimals, and timestamp)
        (uint256 rawValue, int8 ftsoDecimals, uint64 ts) = ftsoV2.getFeedById(
            ftsoFeedId
        );
        require(ts != 0, "FTSO_NO_DATA");

        // Cache the price in Pyth's format
        _latestPrice = Price({
            price: int64(uint64(rawValue)), // Safe two-step cast
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

    /**
     * @notice Updates the description text.
     * @param newDesc The new description string.
     */
    function setDescription(string calldata newDesc) external {
        // Optional: make this ownable if you want; left open for simplicity
        descriptionText = newDesc;
    }

    /**
     * @notice A helper function to view the currently cached price data.
     */
    function latestPrice() external view returns (Price memory) {
        return _latestPrice;
    }
}
