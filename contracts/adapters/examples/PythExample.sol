// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {FtsoPythAdapterBase} from "../PythAdapter.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/**
 * @title PythNftMinter
 * @notice A simple contract that mints an NFT for $1 worth of a given asset.
 * @dev This contract IS a Pyth-compatible price feed and uses its own inherited
 * functions to value the asset for minting.
 */
contract PythNftMinter is FtsoPythAdapterBase {
    uint256 private _nextTokenId;
    error InsufficientFee();

    constructor(
        bytes21 _ftsoFeedId,
        bytes32 _pythPriceId,
        string memory _description
    ) FtsoPythAdapterBase(_ftsoFeedId, _pythPriceId, _description) {}

    // --- Public Refresh Function ---
    function _refresh() external {
        this.refresh();
    }

    function mint() public payable {
        PythStructs.Price memory price = this.getPriceNoOlderThan(
            pythPriceId,
            60
        );

        uint assetPrice18Decimals = (uint(uint64(price.price)) * (10 ** 18)) /
            (10 ** uint(uint32(-1 * price.expo)));
        uint oneDollarInWei = ((10 ** 18) * (10 ** 18)) / assetPrice18Decimals;

        if (msg.value < oneDollarInWei) {
            revert InsufficientFee();
        }

        _mint(msg.sender);
    }

    function _mint(address to) private {
        // Mocking minting logic
        _nextTokenId++;
    }

    function getTokenCounter() public view returns (uint256) {
        return _nextTokenId;
    }
}
