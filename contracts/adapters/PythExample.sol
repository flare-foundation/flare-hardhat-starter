// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import { FtsoPythAdapterLibrary } from "@flarenetwork/ftso-adapters/contracts/coston2/PythAdapter.sol";
import { IPyth, PythStructs } from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

/**
 * @title PythNftMinter
 * @notice Mints an NFT for $1 worth of an asset, using FTSO data via a Pyth-compatible interface.
 * @dev This contract implements the IPyth interface and uses the FtsoPythAdapterLibrary for its logic.
 */
contract PythNftMinter is IPyth {
    // --- Adapter State ---
    bytes21 public immutable ftsoFeedId;
    bytes32 public immutable pythPriceId;
    string public descriptionText;

    // The PythNftMinter is now responsible for storing the cached price data.
    PythStructs.Price private _latestPrice;

    // --- Minter-Specific State ---
    uint256 private _nextTokenId;
    error InsufficientFee();

    constructor(bytes21 _ftsoFeedId, bytes32 _pythPriceId, string memory _description) {
        // Initialize the adapter configuration state.
        ftsoFeedId = _ftsoFeedId;
        pythPriceId = _pythPriceId;
        descriptionText = _description;
    }

    // --- Public Adapter Functions ---
    function refresh() external {
        // Call the library's logic, passing this contract's state to be updated.
        FtsoPythAdapterLibrary.refresh(_latestPrice, ftsoFeedId, pythPriceId);
    }

    // --- Core Minter Functions ---
    function mint() public payable {
        // Call this contract's own public getPriceNoOlderThan function.
        PythStructs.Price memory price = getPriceNoOlderThan(pythPriceId, 60);

        uint256 assetPrice18Decimals = (uint256(uint64(price.price)) * (10 ** 18)) /
            (10 ** uint256(uint32(-1 * price.expo)));
        uint256 oneDollarInWei = ((10 ** 18) * (10 ** 18)) / assetPrice18Decimals;

        if (msg.value < oneDollarInWei) revert InsufficientFee();
        _mint(msg.sender);
    }

    function getPriceNoOlderThan(bytes32 _id, uint256 _age) public view override returns (PythStructs.Price memory) {
        return FtsoPythAdapterLibrary.getPriceNoOlderThan(_latestPrice, pythPriceId, _id, _age);
    }

    function getPriceUnsafe(bytes32 _id) public view override returns (PythStructs.Price memory) {
        return FtsoPythAdapterLibrary.getPriceUnsafe(_latestPrice, pythPriceId, _id);
    }

    function _mint(address /* to */) private {
        _nextTokenId++; // Mocking minting logic
    }
    // solhint-disable-next-line ordering

    function getTokenCounter() public view returns (uint256) {
        return _nextTokenId;
    }

    // --- Unsupported IPyth Functions (Required for interface compliance) ---
    function getEmaPriceUnsafe(bytes32) external view override returns (PythStructs.Price memory) {
        revert("UNSUPPORTED");
    }
    function getEmaPriceNoOlderThan(bytes32, uint256) external view override returns (PythStructs.Price memory) {
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
    function getUpdateFee(bytes[] calldata) external view override returns (uint256) {
        revert("UNSUPPORTED");
    }
    function getTwapUpdateFee(bytes[] calldata) external view override returns (uint256) {
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
    ) external payable override returns (PythStructs.PriceFeed[] memory, uint64[] memory) {
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
}
