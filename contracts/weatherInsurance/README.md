# Weather Insurance

## How it works

1. A policyholder prepares a policy on the smart contract containing:

   - Location of insured asset (latitude, longitude)
   - Policy duration (start and expiration timestamp)
   - Hourly rainfall threshold constituting the loss
   - Premium amount
   - Loss coverage amount
     A `NewPolicyOpened` event is emitted.

2. The insurer deposits the loss coverage amount to the smart contract, thus accepting the policy.
   The premium is paid out to the insurer.
   A `PolicyAccepted` event is emitted.

3. The Policy is resolved in two ways:
   1. A proof is provided to the smart contract, demonstrating that a loss occurred (the appropriate hourly amount of rainfall has been reached). The loss coverage deposit is paid out to the policyholder.
   2. The policy expiration timestamp is reached, and no valid proof of loss was provided. The loss coverage deposit is refunded to the insurer.

<!-- TODO policies that were not accepted - refund policy? -->
