# Cross-chain Payment

These are the contracts used in the Cross-chain payment FDC use case example.
To learn more about running the example, look at the `scripts/crossChainPayment` directory.

## How it works

1. A user makes a payment of an appropriate amount to the owner address on another chain.
2. An NFT is minted to the user on the Flare chain.

## Contracts

- `NFT.sol:MyNFT`: is the NFT contract that is minted on a payment
- `Minter.sol:NFTMinter`: is the contract that accepts a proof of payment, and mints the NFT
