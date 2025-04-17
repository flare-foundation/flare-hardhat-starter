# Weather Insurance

This is an example of how to use FDC to create a simple insurance dApp.

The demo workflow for this example is as follows.

- Run `deployAgency.ts` to deploy an insurance agency to the `Coston` chain.
- Update `agencyAddress` value in `config.ts` to match that of the newly-deployed agency.
- Run `createPolicy.ts` to create a new policy.
- Do one of the following:
  - Resolve a policy
    - Run `claimPolicy.ts` to claim a policy, changing the `policyId` field at the top of the file if necessary.
    - Run `resolvePolicy.ts` to resolve a policy, changing the `policyId` field at the top of the file if necessary.
  - Expire a policy
    - Run `claimPolicy.ts` to claim a policy, changing the `policyId` field at the top of the file if necessary.
    - Wait for the expiration timestamp of the policy to be reached.
    - Run `expirePolicy.ts` to expire a policy, changing the `policyId` field at the top of the file if necessary.
  - Retire an unclaimed policy
    - Wait for the start timestamp of the policy to be reached.
    - Run `retireUnclaimedPolicy.ts` to expire a policy, changing the `policyId` field at the top of the file if necessary.

For the `minTemp` example, the scripts are run with the following command.

```sh
yarn hardhat run scripts/weatherInsurance/minTemp/<FileName.ts> --network <network>
```

The corresponding contracts are defined in `contracts/weatherInsurance/minTemp/<FileName.ts>`.

For the `weatherId` example, the scripts are run with the following command.

```sh
yarn hardhat run scripts/weatherInsurance/weatherId/<FileName.ts> --network <network>
```

The corresponding contracts are defined in `contracts/weatherInsurance/weatherId/<FileName.ts>`.

You can copy the exact command from a comment at the top of each script, after the imports.

For an in-depth guide on the MinTemp weather insurance, go to the [Flare Developer Hub](https://dev.flare.network/fdc/guides/hardhat/weather-insurance).
