# Proof of reserves

This is an example of how to use FDC to verify that total reserves of a stable coin do not amount to more than their claimed dollar backing is.

The demo workflow for this example is as follows.

- Run `deployToken.ts` to deploy a stable coin to `Coston` and `Coston2` chains.
- Run `deployTokenStateReader.ts` to deploy `TokenStateReader` contracts to `Coston` and `Coston2` chains.
- Run `deployProofOfReserves.ts` to deploy `ProofOfReserves` contract to `Coston2` chain.
- Run `activateTokenStateReader.ts` to trigger `TotalTokenSupply` events in reader contracts (this will expose token amount states through a transaction).
- Run `verifyProofOfReserves.ts` to retrieve event data from the transactions, and the Web2 source, through FDC, and verify the the reserves on `Coston2`.

The new addresses and transaction hashes are updated automatically.
They are saved to separate files in the `scripts/proofOfReserves/config` directory.

Scripts are run with the following command.

```sh
yarn hardhat run scripts/proofOfReserves/<FileName.ts> --network <network>
```

You can copy the exact command from a comment at the top of each script, after the imports.

The corresponding contracts are defined in `contracts/proofOfReserves/<FileName.ts>`.

For an in-depth guide on the Proof of reserves, go to the [Flare Developer Hub](https://dev.flare.network/fdc/guides/hardhat/proof-of-reserves).
