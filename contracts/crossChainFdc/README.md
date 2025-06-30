# Cross-chain FDC

These are the contracts used in the examples for FDC attestation types.
For a more detailed explanation, look at `scripts/fdcExamples/README.md`.

Most of the contracts were copied from the [flare-smart-contracts](https://gitlab.com/flarenetwork/flare-smart-contracts) and [flare-smart-contracts-v2](https://github.com/flare-foundation/flare-smart-contracts-v2) repositories, with slight modifications to imports.
The `IFdcVerification.sol` was re-written to work on a non-native chain.
The `Web2Json.sol` was copied from the `fdcExample` directory;
an additional constructor parameter was added to specify the `FdcVerification` contract.
