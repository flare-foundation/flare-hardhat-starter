# Weather Insurance

These are the contracts used in the Weather insurance FDC use case example.
To learn more about running the example, look at the `scripts/weatherInsurance` directory.
A detailed guide on this example is available on the [Flare Developer Hub](https://dev.flare.network/fdc/guides/hardhat/weather-insurance) website.

## How it works

1. A policyholder prepares a policy on the smart contract containing:

   - Location of insured asset (latitude, longitude)
   - Policy duration (start and expiration timestamp)
   - Criterion for a loss
   - Premium amount
   - Loss coverage amount
     A `NewPolicyOpened` event is emitted.

2. The insurer deposits the loss coverage amount to the smart contract, thus accepting the policy.
   The premium is paid out to the insurer.
   A `PolicyAccepted` event is emitted.

3. The Policy is resolved in two ways.
   1. A proof is provided to the smart contract, demonstrating that a loss occurred.
      The loss coverage deposit is paid out to the policyholder.
      A `PolicySettled` event is emitted.
   2. The policy expiration timestamp is reached, and no valid proof of loss was provided.
      The loss coverage deposit is refunded to the insurer.
      A `PolicyExpired` event is emitted.

If a policy start timestamp is reached, and no insurer has claimed the policy, it is retired and the premium is refunded to the policyholder.
A `PolicyRetired` event is emitted.

## Contracts

The `MinTempAgency` and `WeatherIdAgency` contract represent two examples of how weather data can be used to create insurance policies.

- A loss in the case of the `MinTempAgency` is that the minimum temperature of a day fell bellow the threshold defined in the policy.
- For the `WeatherIdAgency` the loss is decided using the [weather condition codes](https://openweathermap.org/weather-conditions).
  If a code falling in the same category as the threshold in the policy, and exceeding it, is returned through the current weather API, that counts as a loss.
