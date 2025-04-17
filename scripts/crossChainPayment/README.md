# Cross-chain payment

This is an example of how to use FDC to perform cross-chain payments.

The demo workflow for this example is as follows.

- Run `deployNFT.ts` to deploy the `MyNFT` contract to the `Coston` chain.
- Update the `nftAddress` value in `config.ts` to match that of the newly-deployed NFT.
- Run `deployMinter.ts` to deploy the `NFTMinter` contract to the `Coston` chain.
- Update the `nftAddress` value in `config.ts` to match that of the newly-deployed minter.
- Run `collectAndProcessTransferEvents.ts` to execute acquire the transaction data using the FDC, and submit it to the minter contract.

Scripts are run with the following command.

```sh
yarn hardhat run scripts/crossChainPayment/<FileName.ts> --network <network>
```

You can copy the exact command from a comment at the top of each script, after the imports.

The corresponding contracts are defined in `contracts/crossChainPayment/<FileName.ts>`.

For an in-depth guide on the Proof of reserves, go to the [Flare Developer Hub](https://dev.flare.network/fdc/guides/hardhat/proof-of-reserves).
