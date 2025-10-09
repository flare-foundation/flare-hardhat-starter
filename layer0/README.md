## L0 Example: Deploying to Mainnet with Flare and Ethereum

This guide provides a complete, step-by-step walkthrough for deploying, configuring, and testing the `MyOApp` contract between **Flare Mainnet** and **Ethereum Mainnet**.

This process requires transactions on both mainnets and will incur real gas fees.

### Prerequisites

1.  **Funded Wallet:** Ensure the EOA (Externally Owned Account) defined by your `PRIVATE_KEY` has enough **FLR** on Flare and **ETH** on Ethereum to pay for contract deployments and transactions.
2.  **RPC Endpoints:** You have reliable RPC URLs for both Ethereum and Flare mainnets.
3.  **Dependencies:** Make sure you have installed the project's dependencies by running `yarn` in the `layer0/` directory.

---

### Step 1: Finalize Your Configuration

Before deploying, make sure your configuration files are set up correctly for a mainnet deployment.

#### 1. Configure Environment Variables

Create or update your `.env` file in the `layer0/` directory with your private key and mainnet RPC URLs.

**File: `layer0/.env`**
```dotenv
PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
RPC_URL_FLARE="https://flare-api.flare.network/ext/C/rpc"
RPC_URL_ETHEREUM="https://your-ethereum-mainnet-rpc-url"
```

#### 2. Configure Hardhat Networks

Ensure your `hardhat.config.ts` includes network definitions for both `ethereum` and `flare`, each with its correct LayerZero Endpoint ID (`eid`).

**File: `layer0/hardhat.config.ts`**
```typescript
// ... imports
networks: {
    'flare': {
        eid: EndpointId.FLARE_V2_MAINNET,
        url: process.env.RPC_URL_FLARE || 'https://flare-api.flare.network/ext/C/rpc',
        accounts,
    },
    'ethereum': { // Add this network definition
        eid: EndpointId.ETHEREUM_V2_MAINNET,
        url: process.env.RPC_URL_ETHEREUM || 'https://rpc.ankr.com/eth',
        accounts,
    },
    // ... other networks
},
// ...
```

#### 3. Configure the Omnichain Graph

Your `layerzero.config.ts` defines which contracts on which chains can communicate. For this mainnet deployment, it should be focused exclusively on Flare and Ethereum.

**File: `layer0/layerzero.config.ts`**
```typescript
import { EndpointId } from '@layerzerolabs/lz-definitions';
import type { OAppOmniGraphHardhat, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat';

// Mainnet Contract Definitions
const ethereumContract: OmniPointHardhat = {
    eid: EndpointId.ETHEREUM_V2_MAINNET,
    contractName: 'MyOApp',
};

const flareContract: OmniPointHardhat = {
    eid: EndpointId.FLARE_V2_MAINNET,
    contractName: 'MyOApp',
};

// Main OAppOmniGraphHardhat Configuration
const config: OAppOmniGraphHardhat = {
    contracts: [
        { contract: ethereumContract },
        { contract: flareContract },
    ],
    connections: [
        {
            from: ethereumContract,
            to: flareContract,
            config: {}, // Using default configuration
        },
        {
            from: flareContract,
            to: ethereumContract,
            config: {}, // Using default configuration
        },
    ],
};

export default config;
```

---

### Step 2: Compile and Deploy

First, compile your contracts. Then, deploy your `MyOApp` contract to each network **individually**.

1.  **Compile Contracts:**
    ```bash
    yarn hardhat compile
    ```

2.  **Deploy to Ethereum Mainnet:**
    ```bash
    yarn hardhat deploy --network ethereum --tags MyOApp
    ```

3.  **Deploy to Flare Mainnet:**
    ```bash
    yarn hardhat deploy --network flare --tags MyOApp
    ```
    Your contract addresses will be saved in the `deployments/` directory, which the wiring task uses in the next step.

---

### Step 3: Wire the Contracts

"Wiring" sets the deployed contracts as trusted peers of one another, enabling cross-chain communication.

```bash
yarn hardhat lz:oapp:wire --oapp-config layerzero.config.ts
```
This command reads your `layerzero.config.ts`, finds the deployed contract addresses, and sends the `setPeer` transactions to both chains.

---

### Step 4: Send a Test Message

Once wired, you can send messages between your deployed OApps using the provided Hardhat tasks.

1.  **Send a message from Ethereum to Flare:**
    *   The destination Endpoint ID (`to-eid`) for Flare is `30295`.
    ```bash
    yarn hardhat lz:oapp:send --network ethereum --message "Hello Flare from Ethereum" --to-eid 30295
    ```

2.  **Send a message from Flare to Ethereum:**
    *   The destination Endpoint ID (`to-eid`) for Ethereum is `30101`.
    ```bash
    yarn hardhat lz:oapp:send --network flare --message "Hello Ethereum from Flare" --to-eid 30101
    ```

You can monitor your cross-chain messages on [LayerZero Scan](https://layerzeroscan.com/) using the transaction hashes from the terminal.

---

### Extending to Other Chains

This repository is structured for easy extension to any other EVM chain supported by LayerZero. To add a new chain (e.g., Polygon), follow this pattern:

1.  **Add the Network to `hardhat.config.ts`**:
    Add a new network entry with its LayerZero `eid`.
    ```typescript
    // In hardhat.config.ts
    'polygon': {
        eid: EndpointId.POLYGON_V2_MAINNET,
        url: process.env.RPC_URL_POLYGON || '...',
        accounts,
    },
    ```

2.  **Update `layerzero.config.ts`**:
    *   Define the new contract endpoint.
        ```typescript
        const polygonContract: OmniPointHardhat = {
            eid: EndpointId.POLYGON_V2_MAINNET,
            contractName: 'MyOApp',
        };
        ```
    *   Add it to the `contracts` array.
        ```typescript
        contracts: [
            { contract: ethereumContract },
            { contract: flareContract },
            { contract: polygonContract }, // Add the new contract
        ],
        ```
    *   Add the desired communication paths to the `connections` array.
        ```typescript
        connections: [
            // ... existing connections
            { from: flareContract, to: polygonContract, config: {} },
            { from: polygonContract, to: flareContract, config: {} },
        ],
        ```

3.  **Deploy and Re-Wire**:
    *   Deploy your contract to the new network: `yarn hardhat deploy --network polygon --tags MyOApp`
    *   Re-run the wiring command: `yarn hardhat lz:oapp:wire --oapp-config layerzero.config.ts`. The LayerZero toolkit is idempotent and will only configure the new, unwired paths.

    Of course. Here is a more direct, developer-focused section for your README that gets straight to the point.

---

### Extensibility

This repository is a starter kit for omnichain development, equipped with tooling for advanced use cases beyond the basic `MyOApp` example.

#### Evolving to OFT (Omnichain Fungible Token)

The project includes a pre-built `MyOFT.sol` contract and corresponding scripts to deploy an Omnichain Fungible Token—a unified token that can be transferred across chains without bridges.

To switch from the default `MyOApp` to the `MyOFT` standard:

1.  **Update `layerzero.config.ts`**: Change the `contractName` in your endpoint definitions from `MyOApp` to `MyOFT`.

    ```typescript
    // layerzero.config.ts
    const ethereumContract: OmniPointHardhat = {
        eid: EndpointId.ETHEREUM_V2_MAINNET,
        contractName: 'MyOFT', // Use the OFT contract
    };

    const flareContract: OmniPointHardhat = {
        eid: EndpointId.FLARE_V2_MAINNET,
        contractName: 'MyOFT', // Use the OFT contract
    };
    ```

2.  **Deploy with the OFT Tag**: Use the `--tags MyOFT` flag to execute the dedicated `deploy/MyOFT.ts` script.

    ```bash
    yarn hardhat deploy --network ethereum --tags MyOFT
    yarn hardhat deploy --network flare --tags MyOFT
    ```

3.  **Wire and Send Tokens**: The wiring command is the same. Use the `lz:oft:send` task to transfer tokens, specifying the amount and recipient.

    ```bash
    # Wire the newly deployed OFT contracts
    yarn hardhat lz:oapp:wire --oapp-config layerzero.config.ts

    # Send 100 tokens from Ethereum to a recipient on Flare
    yarn hardhat lz:oft:send --network ethereum --dst-eid 30295 --amount "100" --to "0xRecipientAddressOnFlare"
    ```

This modular pattern can be replicated to support ONFTs (Omnichain Non-Fungible Tokens) or other custom OApp standards.

#### Multi-Chain Architecture (EVM & Non-EVM)

The repository is architected for both EVM and non-EVM chains, with Solana as a primary example.

*   **Solana Tooling**: The `tasks/solana/` directory contains a suite of scripts for creating, deploying, and managing Solana-based OFTs (e.g., `createOFT.ts`, `sendSolana.ts`). Note: These tasks were commented out for the EVM-EVM example.
*   **Unified Orchestration**: The custom wiring task at `tasks/common/wire.ts` is designed to handle mixed-environment deployments (e.g., EVM to Solana). It was disabled in the EVM-only guide but can be re-enabled for multi-chain topologies by renaming it from `wire.ts.disabled` back to `wire.ts`.

#### Development & Testing Toolkit

The project includes a suite of Hardhat tasks and a testing framework to accelerate development.

*   **Utility Tasks**: The `tasks/` directory contains scripts for common omnichain operations, such as inspecting on-chain configurations (`lz:oapp:config:get`) or setting gas parameters (`lz:lzapp:set-min-dst-gas`).
*   **Local Testing Framework**: The `test/` directory demonstrates how to write unit and integration tests using LayerZero's `EndpointV2Mock`. This allows for simulating cross-chain transactions in a local Hardhat environment, enabling you to validate your OApp's logic without deploying to a live network. See `test/hardhat/MyOApp.test.ts` for an implementation example.