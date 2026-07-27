# Firelight Vault (Coston2)

Example scripts for the Firelight ERC-4626 vault on Flare Coston2. Deposit FTestXRP,
receive `stXRP` shares, request a delayed withdrawal, then claim after the period ends.

See [Firelight docs — Deployments and Withdrawals](https://docs.firelight.finance/for-stakers/deployments-and-withdrawals)
and [Flare Developer Hub — Firelight](https://dev.flare.network/fxrp/firelight).

## Deployment

| Item          | Value                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Vault (proxy) | [`0xC90D6847747b85d1fa2E07859869fb9fB72c0361`](https://coston2-explorer.flare.network/address/0xC90D6847747b85d1fa2E07859869fb9fB72c0361) |
| Share token   | `stXRP` (6 decimals)                                                                                                                      |
| Underlying    | FTestXRP via `vault.asset()` (`0x0b6A3645c240605887a5532109323A3E12273dc7`)                                                               |

Address is centralized in [`constants.ts`](./constants.ts). Scripts resolve the asset
from the vault; hold FTestXRP before running deposit/mint.

## Flow

1. **deposit** / **mint** — stake FTestXRP, receive `stXRP` shares immediately
2. **withdraw** / **redeem** — create a withdrawal request for the current period (assets are not transferred yet)
3. Wait until the period ends
4. **claim** — call `claimWithdraw` for claimable past periods

## Scripts

| Script        | Purpose                                                          |
| ------------- | ---------------------------------------------------------------- |
| `status.ts`   | Vault metrics, period config, user balances, pending withdrawals |
| `deposit.ts`  | Deposit a fixed amount of FTestXRP                               |
| `mint.ts`     | Mint a fixed number of vault shares                              |
| `withdraw.ts` | Request withdrawal of a fixed asset amount                       |
| `redeem.ts`   | Request redemption of a fixed share amount                       |
| `claim.ts`    | Claim completed withdrawals (auto-detect or set `periodToClaim`) |

## Run

```bash
yarn hardhat run scripts/firelight/status.ts --network coston2
yarn hardhat run scripts/firelight/deposit.ts --network coston2
yarn hardhat run scripts/firelight/mint.ts --network coston2
yarn hardhat run scripts/firelight/withdraw.ts --network coston2
yarn hardhat run scripts/firelight/redeem.ts --network coston2
yarn hardhat run scripts/firelight/claim.ts --network coston2
```

Requires `PRIVATE_KEY` (and Flare RPC keys) in `.env`. Adjust the amount constants at
the top of each script before sending transactions.
