# nuxt-x402

Nuxt module for [x402](https://docs.x402.org) — paid API routes using the HTTP `402 Payment Required` status code.

- **Server:** middleware that answers paid routes with a 402 challenge, then verifies and settles the payment through an x402 facilitator (Coinbase CDP by default).
- **Client:** composables to connect MetaMask and pay with USDC automatically when a request returns 402.

Implements x402 v2 (`PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE` headers) with the `exact` scheme on Base and Base Sepolia.

## Install

```bash
npm install nuxt-x402
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-x402'],

  x402: {
    routes: {
      'GET /api/premium': { price: '$0.001', network: 'eip155:84532', description: 'Premium content' },
    },
  },
})
```

```bash
# .env
X402_PAY_TO=0xYourReceivingAddress
CDP_API_KEY_ID=your-cdp-key-id
CDP_API_KEY_SECRET=your-cdp-key-secret
```

CDP API keys are created in the [Coinbase Developer Platform](https://portal.cdp.coinbase.com). Both ECDSA (PEM) and Ed25519 secrets are supported.

## Options

| Option | Default | Description |
|---|---|---|
| `routes` | `{}` | Paid routes keyed by `"METHOD /path"` (exact match). Each takes `price` (USD, paid in USDC), optional `network` and `description`. |
| `payTo` | `X402_PAY_TO` | Address that receives payments. |
| `facilitatorUrl` | `https://api.cdp.coinbase.com/platform/v2/x402` | Facilitator used for `/verify` and `/settle`. |
| `cdpApiKeyId` | `CDP_API_KEY_ID` | CDP API key id. When empty, no auth header is sent. |
| `cdpApiKeySecret` | `CDP_API_KEY_SECRET` | CDP API key secret. |
| `enabled` | `true` | Set to `false` to disable the module. |

Supported networks: `eip155:84532` (Base Sepolia, default) and `eip155:8453` (Base).

## Usage

### Server

Write the route as usual. The middleware only lets the request through after the payment is verified and settled, and exposes the result on `event.context.x402`:

```ts
// server/api/premium.ts
export default defineEventHandler((event) => {
  const { payer, txHash } = event.context.x402
  return { message: 'Paid content', payer, txHash }
})
```

### Client

```vue
<script setup lang="ts">
const { wallet, connect } = useWallet()
const { pay, isPaying, error } = useX402Payment()

async function load() {
  // Fetches the route; on 402 it signs the payment in MetaMask and retries
  const response = await pay('/api/premium')
  console.log(await response.json())
}
</script>

<template>
  <button v-if="!wallet.isConnected" @click="connect">Connect MetaMask</button>
  <button v-else :disabled="isPaying" @click="load">Pay & load</button>
  <p v-if="error">{{ error }}</p>
</template>
```

| Composable | Returns |
|---|---|
| `useWallet()` | `wallet` (`address`, `isConnected`, `isLoading`, `error`), `connect()`, `disconnect()` |
| `useX402Payment()` | `pay(url, init?)` — `fetch` with automatic 402 handling, `isPaying`, `error` |

The paying wallet needs USDC on the route's network. For Base Sepolia, get test USDC from the [Circle faucet](https://faucet.circle.com).

## Development

```bash
npm install
npm run dev     # playground at http://localhost:3000, reads .env from the repo root
npm run build
```

## License

MIT
