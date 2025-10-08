# LayerZero OApp (Layer0) — Flare Mainnet + Ethereum Sepolia

This `layer0/` subproject demonstrates deploying and wiring a minimal LayerZero v2 OApp (`MyOApp`) between Flare mainnet and Ethereum Sepolia from within the Flare Hardhat Starter repository.

It uses Hardhat + `@layerzerolabs/toolbox-hardhat` to automatically resolve LayerZero EndpointV2 deployments via EIDs defined in `layer0/hardhat.config.ts`.

---

## What’s here

- **Contract**: `layer0/contracts/MyOApp.sol`
  - Simple OApp that sends/receives string messages across chains via LayerZero v2.
- **Deploy script**: `layer0/deploy/MyOApp.ts`
- **Config**:
  - Hardhat networks: `layer0/hardhat.config.ts`
  - OApp graph + connections (optional wiring): `layer0/layerzero.config.ts`

---

## Prerequisites

- Node.js >= 18.16
- Yarn
- A funded EOA private key with native gas on both networks:
  - Flare mainnet (FLR)
  - Ethereum Sepolia (ETH)
- RPC endpoints for both networks

---

## Environment setup

Create a `.env` inside `layer0/` (recommended), since `layer0/hardhat.config.ts` loads env when you run Hardhat from this directory:

```bash
cd layer0
cp ../.env.example .env   # or create a fresh file if you prefer
```

Edit `layer0/.env` and set at least:

```dotenv
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
RPC_URL_FLARE=https://flare-api.flare.network/ext/C/rpc
RPC_URL_SEPOLIA=https://sepolia.gateway.tenderly.co
```

Tip: You can use other RPCs. The network names used by Hardhat are `flare` and `sepolia-testnet` (see `layer0/hardhat.config.ts`).

---

## Install dependencies

After following the README in the root directory, install dependencies for this subproject:

```bash
cd layer0
yarn
```

---

## Verify network config

Open `layer0/hardhat.config.ts` and confirm networks:

- `flare`
  - `eid: EndpointId.FLARE_V2_MAINNET` (30295)
  - `url: process.env.RPC_URL_FLARE`
- `sepolia-testnet`
  - `eid: EndpointId.SEPOLIA_TESTNET`
  - `url: process.env.RPC_URL_SEPOLIA`

Hardhat-deploy and toolbox will auto-load LayerZero EndpointV2 deployment artifacts for these EIDs.

---

Adjust your script before proceeding if needed.

---

## Compile

From `layer0/`:

```bash
npx hardhat compile
```

---

## Deploy

Deploy to Sepolia first:

```bash
npx hardhat deploy --network sepolia-testnet --tags MyOApp
```

Take note of the deployed `MyOApp` address on Sepolia.

Deploy to Flare mainnet:

```bash
npx hardhat deploy --network flare --tags MyOApp
```

Take note of the deployed `MyOApp` address on Flare.

---

## Wire peers (set each chain’s peer to the other)

You can wire peers via the LayerZero toolbox using either the simple “wire from config” flow or individual peer-setting commands.

### Option A: Wire from config (recommended)

1) Open `layer0/layerzero.config.ts` and ensure the `contracts` entries include your chains with the correct `contractName` (`'MyOApp'`) and EIDs for Flare (30295) and Sepolia (see `EndpointId.SEPOLIA_TESTNET`).

2) Run the wiring task:

```bash
npx hardhat lz:oapp:wire --oapp-config layerzero.config.ts --log-level debug
```

This will set peers on both ends according to the config and any DVN/executor options provided there.

### Option B: Set peers manually

If you prefer manual control, run for each direction:

```bash
# On Flare, set Sepolia as peer
npx hardhat lz:oapp:set-peer \
  --network flare \
  --local-contract MyOApp \
  --remote-eid <SEPOLIA_EID> \
  --peer <MyOApp_address_on_Sepolia>

# On Sepolia, set Flare as peer
npx hardhat lz:oapp:set-peer \
  --network sepolia-testnet \
  --local-contract MyOApp \
  --remote-eid 30295 \
  --peer <MyOApp_address_on_Flare>
```

Replace placeholders with the actual addresses/EIDs. You can find EIDs and EndpointV2 addresses in LayerZero docs.

---

## Sending a test message

`MyOApp` exposes:

- `sendMessage(uint32 dstEid, string message, bytes options)`
- `event MessageReceived(uint32 srcEid, address srcAddress, uint64 nonce, string message)`

Because OApps typically require execution gas options, make sure your wiring or enforced options provide sufficient executor gas. If you did Option A above and your `layerzero.config.ts` includes appropriate `enforcedOptions`, you can try a simple send.

Example via Hardhat console (send from Sepolia to Flare):

```bash
npx hardhat console --network sepolia-testnet
```

```js
const my = await ethers.getContract('MyOApp')
const FLARE_EID = 30295
const OPTIONS = '0x' // replace with properly encoded executor options if required by your setup
const tx = await my.sendMessage(FLARE_EID, 'Hello Flare!', OPTIONS, { value: ethers.utils.parseEther('0.01') })
await tx.wait()
```

Then watch for `MessageReceived` on Flare:

```bash
npx hardhat console --network flare
```

```js
const my = await ethers.getContract('MyOApp')
const filter = my.filters.MessageReceived()
const logs = await my.queryFilter(filter, 'latest')
logs
```

If the transaction reverts due to missing/insufficient executor options, either:
- Increase gas/options in `layerzero.config.ts` `enforcedOptions`, then re-run `lz:oapp:wire`.
- Pass properly encoded options to `sendMessage` (see LayerZero options docs).

---

## Verification (optional)

Use your preferred explorer verification plugins. Example (if configured):

```bash
npx hardhat verify --network flare <MyOApp_address> <EndpointV2_address> <Delegate_address>
```

---

## Troubleshooting

- Ensure `eid` is present in each network config in `layer0/hardhat.config.ts`. The toolbox uses it to resolve `EndpointV2`.
- If wiring fails, double-check EIDs and contract names in `layer0/layerzero.config.ts` and use Option B to set peers manually.
- Foundry/Anchor outputs like `out/`, `target`, `.anchor` are ignored at the repo root via `.gitignore`.

---

## Switching to OFT or ONFT

- **Is it possible right now?** Not out-of-the-box. This subproject currently ships with `MyOApp` (a generic OApp). To use OFT or ONFT, first add the relevant packages, then swap the contract and update the deploy/config references.

### 1) Install packages (from `layer0/`)

```bash
cd layer0
yarn add -D @layerzerolabs/oft-evm    # for OFT (ERC20 cross-chain)
# optional, if you also want ONFT:
yarn add -D @layerzerolabs/onft-evm   # for ONFT (ERC721 cross-chain)
```

### 2) Replace the contract

- Create `contracts/MyOFT.sol` inheriting from `@layerzerolabs/oft-evm/contracts/OFT.sol` and (optionally) `@openzeppelin/contracts/access/Ownable.sol`.
- Or create `contracts/MyONFT.sol` using `@layerzerolabs/onft-evm` patterns.
- Ensure the constructor args match your chosen implementation (e.g., name, symbol, `EndpointV2` address, `delegate`).

### 3) Update the deploy script

- Copy `deploy/MyOApp.ts` to `deploy/MyOFT.ts` (or `MyONFT.ts`) and adjust:
  - `contractName` to `MyOFT` (or `MyONFT`).
  - Constructor args to match your new contract.
  - Keep `const endpointV2Deployment = await hre.deployments.get('EndpointV2')`.
  - Update `deploy.tags = ['MyOFT']` (or `['MyONFT']`).

### 4) Update config references

- In `layer0/layerzero.config.ts`, change `contractName` entries to `MyOFT` (or `MyONFT`) for each chain.
- Keep the same network `eid` settings in `layer0/hardhat.config.ts`.

### 5) Deploy and wire

```bash
npx hardhat compile
npx hardhat deploy --network sepolia-testnet --tags MyOFT
npx hardhat deploy --network flare --tags MyOFT
npx hardhat lz:oapp:wire --oapp-config layerzero.config.ts --log-level debug
```

Swap `MyOFT` with `MyONFT` if you’re using ONFT. Use the manual peer commands if you prefer fine-grained control.

---

## References

- LayerZero v2 Chain Deployments: https://docs.layerzero.network/v2/deployments/deployed-contracts
- Flare mainnet: https://docs.layerzero.network/v2/deployments/chains/flare
- Flare testnet (Coston2): https://docs.layerzero.network/v2/deployments/chains/flare-testnet
