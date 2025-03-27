# FDC Examples

This is a collection of examples on how to use the FDC protocol. Each script corresponds to one of the supported attestation types:

- `AddressValidity.ts`
- `BalanceDecreasingTransaction.ts`
- `ConfirmedBlockHeightExists.ts`
- `EVMTransaction.ts`
- `JsonApi.ts`
- `Payment.ts`
- `ReferencedPaymentNonexistence.ts`.

Scripts are run with the following command.

```sh
yarn hardhat run scripts/fdcExample/<AttestationType.ts> --network <network>
```

You can copy the exact command from a comment at the top of each script, after the imports.

The corresponding contracts are defined in `contracts/fdcExample/<AttestationType.ts>`.

For an in-depth guides on how to use different attestation types, go to the [Flare Developer Hub](https://dev.flare.network/fdc/guides/hardhat).
