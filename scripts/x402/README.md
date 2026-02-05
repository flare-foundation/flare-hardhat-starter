# x402 Payment Demo with EIP-3009

This demo implements the [x402 payment protocol](https://www.x402.org/) using EIP-3009 `transferWithAuthorization` for gasless payment settlements on Coston2.

## Overview

The x402 protocol enables HTTP-native payments using the long-reserved 402 "Payment Required" status code. This implementation demonstrates:

1. **MockUSDT0** - ERC20 token with EIP-3009 support (transferWithAuthorization)
2. **X402Facilitator** - Contract that verifies and settles EIP-3009 authorizations
3. **Server** - Express backend implementing x402 payment flow
4. **Agent** - CLI tool for making automated payments

## EIP-3009 Flow

```
┌─────────┐     1. Request Resource      ┌─────────────┐
│  Agent  │ ─────────────────────────────▶│   Server    │
│         │ ◀───────────────────────────── │             │
│         │     2. 402 + Payment Req      │             │
│         │                                │             │
│         │     3. Sign EIP-712 Auth       │             │
│         │     (off-chain signature)      │             │
│         │                                │             │
│         │     4. Request + X-Payment     │             │
│         │ ─────────────────────────────▶│             │
│         │                    ┌───────────┴─────────────┤
│         │               5. settlePayment()             │
│         │                    │                         │
│         │                    ▼                         │
│         │              ┌─────────────┐                 │
│         │              │ Facilitator │                 │
│         │              └──────┬──────┘                 │
│         │                     │                        │
│         │         6. transferWithAuthorization         │
│         │                     │                        │
│         │                     ▼                        │
│         │              ┌─────────────┐                 │
│         │              │  MockUSDT0  │                 │
│         │              └─────────────┘                 │
│         │                                │             │
│         │ ◀───────────────────────────── │             │
└─────────┘     7. 200 OK + Resource      └─────────────┘
```

## Quick Start

### 1. Deploy Contracts

```bash
yarn hardhat run scripts/x402/deploy.ts --network coston2
```

Add the output to your `.env`:

```env
X402_TOKEN_ADDRESS=0x...
X402_FACILITATOR_ADDRESS=0x...
X402_PAYEE_ADDRESS=0x...
```

### 2. Test EIP-3009 Directly

```bash
yarn hardhat run scripts/x402/testEip3009.ts --network coston2
```

### 3. Start Server

```bash
npx ts-node scripts/x402/server.ts
```

Server runs on `http://localhost:3402`

### 4. Run Agent

```bash
npx ts-node scripts/x402/agent.ts
```

## Contracts

### MockUSDT0 (`contracts/x402/MockUSDT0.sol`)

ERC20 with full EIP-3009 support:

```solidity
function transferWithAuthorization(
    address from,
    address to,
    uint256 value,
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    uint8 v, bytes32 r, bytes32 s
) external;

function receiveWithAuthorization(...) external;  // Front-running protected
function authorizationState(address, bytes32) view returns (bool);
function DOMAIN_SEPARATOR() view returns (bytes32);
```

### X402Facilitator (`contracts/x402/X402Facilitator.sol`)

```solidity
function verifyPayment(PaymentPayload) view returns (bytes32 paymentId, bool valid);
function settlePayment(PaymentPayload) returns (bytes32 paymentId);
function settlePaymentAsPayee(PaymentPayload) returns (bytes32);  // receiveWithAuthorization
```

## API Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/public` | Free | Public data |
| `GET /api/premium-data` | 0.1 USDT0 | Premium data |
| `GET /api/report` | 0.5 USDT0 | Detailed report |
| `GET /health` | Free | Health check |

## x402 Protocol Headers

### 402 Response

```json
{
  "error": "Payment Required",
  "x402Version": "1",
  "accepts": [{
    "scheme": "exact",
    "network": "flare-coston2",
    "maxAmountRequired": "100000",
    "payTo": "0x...",
    "asset": "USDT0",
    "extra": {
      "tokenAddress": "0x...",
      "facilitatorAddress": "0x...",
      "chainId": 114
    }
  }]
}
```

### X-Payment Header (Base64 JSON)

```json
{
  "from": "0x...",
  "to": "0x...",
  "token": "0x...",
  "value": "100000",
  "validAfter": "1704067200",
  "validBefore": "1704070800",
  "nonce": "0x...",
  "v": 28,
  "r": "0x...",
  "s": "0x..."
}
```

### X-Payment-Response Header (Base64 JSON)

```json
{
  "paymentId": "0x...",
  "transactionHash": "0x...",
  "settled": true
}
```

## EIP-712 Signature

```typescript
const domain = {
  name: "Mock USDT0",
  version: "1",
  chainId: 114,
  verifyingContract: tokenAddress
};

const types = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" }
  ]
};

const message = {
  from: userAddress,
  to: payeeAddress,
  value: amount,
  validAfter: Math.floor(Date.now() / 1000) - 60,
  validBefore: Math.floor(Date.now() / 1000) + 300,
  nonce: ethers.hexlify(ethers.randomBytes(32))
};

const signature = await wallet.signTypedData(domain, types, message);
```

## Security Notes

1. **Front-running**: Use `receiveWithAuthorization` when payee is a contract
2. **Nonce**: Always use cryptographically random 32-byte nonces
3. **Time bounds**: Set reasonable `validAfter`/`validBefore` windows
4. **Domain**: Verify contract address in EIP-712 domain

## References

- [EIP-3009: Transfer With Authorization](https://eips.ethereum.org/EIPS/eip-3009)
- [x402 Protocol](https://www.x402.org/)
- [Coinbase x402 GitHub](https://github.com/coinbase/x402)
- [USDT0 Developer Guide](https://docs.usdt0.to/technical-documentation/developer)
