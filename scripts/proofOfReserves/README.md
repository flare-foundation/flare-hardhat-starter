# Proof of reserves

This is an example of how to use FDC to verify that total reserves of a stable coin do not amount to more than their claimed dollar backing is.

The demo workflow for this example is as follows.

- Run `deployToken.ts` to deploy a stable coin to `Coston` and `Coston2` chains.
- Run `deployTokenStateReader.ts` to deploy `TokenStateReader` contracts to `Coston` and `Coston2` chains.
- Run `deployProofOfReserves.ts` to deploy `ProofOfReserves` contract to `Coston2` chain.
- Update the `tokenAddresses`, `readerAddresses`, and `ProofOfReservesAddress` in `config.ts` to match those from previous steps (will be written to console as each script is run).
- Run `activateTokenStateReader.ts` to trigger `TotalTokenSupply` events in reader contracts (this will expose token amount states through a transaction).
- Update `transactionHashes` in `config.ts` to match those from the previous step (will be written to console as the script is run).
- Run `verifyProofOfReserves.ts` to retrieve event data from the transactions, and the Web2 source, through FDC, and verify the the reserves on `Coston2`.

Scripts are run with the following command.

```sh
yarn hardhat run scripts/proofOfReserves/<FileName.ts> --network <network>
```

You can copy the exact command from a comment at the top of each script, after the imports.

The corresponding contracts are defined in `contracts/proofOfReserves/<FileName.ts>`.

For an in-depth guide on the Proof of reserves, go to the [Flare Developer Hub](https://dev.flare.network/fdc/guides/hardhat/proof-of-reserves).
