// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/**
 * @title PythNftMinter
 * @notice A simple contract that mints an NFT for a given price.
 * @dev This contracts uses the Pyth Network's IPyth interface to get the price of an asset.
 * It implements simple minting logic and uses the FTSO price adapter to get the price of an asset.
 */
contract PythNftMinter {
    IPyth internal ftsoAdapter;
    bytes32 internal priceId;

    // A simple counter for NFT token IDs
    uint256 private _nextTokenId;

    error InsufficientFee();

    constructor(address _ftsoAdapterAddress, bytes32 _priceId) {
        // Implementing the IPyth interface
        ftsoAdapter = IPyth(_ftsoAdapterAddress);
        priceId = _priceId;
    }

    function mint() public payable {
        PythStructs.Price memory price = ftsoAdapter.getPriceNoOlderThan(
            priceId,
            60
        );

        uint assetPrice18Decimals = (uint(uint64(price.price)) * (10 ** 18)) /
            (10 ** uint(uint32(-1 * price.expo)));
        uint oneDollarInWei = ((10 ** 18) * (10 ** 18)) / assetPrice18Decimals;

        if (msg.value < oneDollarInWei) {
            revert InsufficientFee();
        }

        // User paid enough, mint the NFT.
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
