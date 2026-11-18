# x402-nuxt

Nuxt module for [x402](https://docs.x402.org) — paid API routes using the HTTP `402 Payment Required` status code.

- **Server:** answers paid routes with a 402 challenge, then verifies and settles the payment through an x402 facilitator (Coinbase CDP by default).
- **Pricing:** fixed prices in `nuxt.config`, amounts chosen by the payer within limits (donations), or prices computed on the server for each request (shop orders, items priced one by one).
- **Client:** composables to connect MetaMask and pay with USDC automatically when a request returns 402.

Implements x402 v2 (`PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE` headers) with the `exact` scheme on Base and Base Sepolia.

## Install

```bash
npm install x402-nuxt
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['x402-nuxt'],

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
X402_ACCESS_SECRET=a-long-random-string   # signs the "already paid" cookie
```

CDP API keys are created in the [Coinbase Developer Platform](https://portal.cdp.coinbase.com). Both ECDSA (PEM) and Ed25519 secrets are supported.

## Options

| Option | Default | Description |
|---|---|---|
| `routes` | `{}` | Paid routes keyed by `"METHOD /path"`. Paths support `:param` and `**` wildcards. Each takes `price` (a USD amount, or `{ min, max, default? }` for a payer-chosen amount), and optional `network`, `description` and `accessMaxAge`. |
| `accessMaxAge` | `86400` (24 h) | Seconds a payment keeps the route unlocked. After settling, the server sets a signed httpOnly cookie for that route, so reloads and new tabs don't pay again. `0` = pay on every request. Applies to fixed prices; payer-chosen and computed prices default to `0`. |
| `accessSecret` | `X402_ACCESS_SECRET` | Secret that signs the access cookie. When empty, a random secret is generated per server process, so paid access is lost on restart. Set it in production. |
| `payTo` | `X402_PAY_TO` | Address that receives payments. |
| `facilitatorUrl` | `https://api.cdp.coinbase.com/platform/v2/x402` | Facilitator used for `/verify` and `/settle`. |
| `cdpApiKeyId` | `CDP_API_KEY_ID` | CDP API key id. When empty, no auth header is sent. |
| `cdpApiKeySecret` | `CDP_API_KEY_SECRET` | CDP API key secret. |
| `enabled` | `true` | Set to `false` to disable the module. |

Supported networks: `eip155:84532` (Base Sepolia, default) and `eip155:8453` (Base).

Prices are USD amounts paid in USDC, written as `'$0.01'` or `'0.01'`, with at most 6 decimals.

## Pricing

**The server always decides the amount that is charged.** The browser can say *what* it is paying for (a product id, an order, a donation amount), but the server turns that into the amount in the 402 challenge. Before calling the facilitator, the module also checks that the signed payment is for exactly that amount, recipient, asset and network. A payment edited on the client, or signed for a price that has changed since, gets a new 402 challenge and is never settled.

| Mode | Where | Who decides the amount | Typical use |
|---|---|---|---|
| [Fixed](#fixed-price) | `nuxt.config` | Config | Paywalled page or API |
| [Payer-chosen](#payer-chosen-amount-donations) | `nuxt.config` with `{ min, max }` | The payer, within server limits | Donations, tips, pay what you want |
| [Computed](#computed-price-shop-checkout-items-priced-one-by-one) | `defineX402Handler` in the route file | Your server code (database, cart) | Shop checkout, articles or files with their own prices |

### Fixed price

```ts
// nuxt.config.ts
x402: {
  routes: {
    'GET /api/premium': { price: '$0.001', description: 'Premium content' },
    // Wildcards: one price for every article
    'GET /api/articles/**': { price: '$0.002' },
  },
}
```

Write the route as usual. The handler only runs after the payment is verified and settled, and gets the result on `event.context.x402`:

```ts
// server/api/premium.ts
export default defineEventHandler((event) => {
  const { payer, txHash } = event.context.x402!
  return { message: 'Paid content', payer, txHash }
})
```

```vue
<script setup lang="ts">
const { wallet, connect } = useWallet()
const { pay, quote, isPaying, error } = useX402Payment()

// Reads the price from the 402 challenge without paying
const price = ref(await quote('/api/premium'))

async function load() {
  // Fetches the route; on 402 it signs the payment in MetaMask and retries
  const response = await pay('/api/premium')
  console.log(await response.json())
}
</script>

<template>
  <button v-if="!wallet.isConnected" @click="connect">Connect MetaMask</button>
  <button v-else :disabled="isPaying" @click="load">Pay {{ price?.amountFormatted }} & load</button>
  <p v-if="error">{{ error }}</p>
</template>
```

### Payer-chosen amount (donations)

Give the route a `{ min, max }` price. The client sends the amount it wants with `pay(url, { amount })`, as the `X402-Amount` header. The server checks it against the bounds (`400` if outside them) and asks for exactly that amount in the 402 challenge. `default` (or `min`) is used when no amount is sent, for example by `quote()` without an amount.

```ts
// nuxt.config.ts
x402: {
  routes: {
    'POST /api/donate': { price: { min: '$0.50', max: '$500', default: '$5' }, description: 'Donation' },
  },
}
```

```ts
// server/api/donate.post.ts
export default defineEventHandler((event) => {
  const { amountFormatted, payer } = event.context.x402!
  return { message: `Thank you for ${amountFormatted}!`, payer }
})
```

```vue
<script setup lang="ts">
const { pay, isPaying } = useX402Payment()
const amount = ref('5')

async function donate() {
  const response = await pay('/api/donate', { method: 'POST', amount: amount.value })
  console.log(await response.json())
}
</script>

<template>
  <input v-model="amount" type="number" min="0.5" max="500" step="0.01">
  <button :disabled="isPaying" @click="donate">Donate {{ amount }} USDC</button>
</template>
```

Payer-chosen routes default to `accessMaxAge: 0`, so each donation is a new payment. Routes with a fixed or computed price ignore `amount`.

### Computed price (shop checkout, items priced one by one)

When the price depends on the request, wrap the route handler in `defineX402Handler` (auto-imported on the server) and compute the price in a function. It runs when the 402 challenge is issued and again when the paid request comes back, so it should give the same result for the same purchase. It can throw (`createError`) to reject the request, for example when an order does not exist or is already paid.

The price function returns the amount, or an object:

| Field | Description |
|---|---|
| `amount` | USD amount, e.g. `'$42.10'` or `42.1`. |
| `key` | What is being paid for, e.g. `'order:123'`. Access cookies are scoped to route + key, so paying for one item never unlocks another. It is passed on as `event.context.x402.key`. |
| `description` | Shown in the 402 challenge (`quote().description`). |
| `network`, `accessMaxAge` | Override the handler options for this request. |

**Shop checkout.** The browser only names the order; the server reads the total. Each order is paid once.

```ts
// server/api/orders/[id]/pay.post.ts
export default defineX402Handler({
  price: async (event) => {
    const order = await getOrder(getRouterParam(event, 'id'))
    if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found' })
    if (order.paid) throw createError({ statusCode: 409, statusMessage: 'Order already paid' })
    return { amount: order.total, key: `order:${order.id}`, description: `Order #${order.id}` }
  },
}, async (event) => {
  const { key, txHash, payer, amount } = event.context.x402!
  await markOrderPaid(key!, { txHash, payer, amount })
  return { ok: true, txHash }
})
```

```ts
// Client: create the order with product ids only, then pay what the server asks
const order = await $fetch('/api/orders', { method: 'POST', body: { items: [{ productId: 'mug', quantity: 2 }] } })
const price = await quote(`/api/orders/${order.id}/pay`, { method: 'POST' })   // amount from the server
const response = await pay(`/api/orders/${order.id}/pay`, { method: 'POST' })
```

Computed prices default to `accessMaxAge: 0`. Keep it that way for purchases, so a paid request is never replayed for a second order.

**Items with their own price** (articles, files, API plans), each unlocked for a while:

```ts
// server/api/articles/[slug].get.ts
export default defineX402Handler({
  price: async (event) => {
    const article = await getArticle(getRouterParam(event, 'slug'))
    return { amount: article.price, key: `article:${article.slug}`, description: article.title }
  },
  accessMaxAge: 60 * 60 * 24,   // keep each paid article unlocked for 24 h
}, async (event) => {
  return await getArticleContent(getRouterParam(event, 'slug'))
})
```

An access cookie only unlocks the same route and `key`, and only while the price is not higher than what was paid.

`defineX402Handler` also accepts a fixed price (`price: '$0.01'`) or bounds (`price: { min, max }`), if you prefer to keep pricing next to the route instead of in `nuxt.config`. Don't declare the same route in both places, or it is charged twice.

### Paid requests and access cookies

After a payment, requests carrying a valid access cookie skip the payment and get the same `event.context.x402` (plus `accessExpiresAt`). To restore paid content after a page reload, fetch the route again; during SSR use `useRequestFetch()` so the cookie is forwarded.

`event.context.x402` contains `txHash`, `payer`, `network`, `networkName`, `amount` (atomic USDC units), `amountFormatted`, `explorerTxUrl`, and when set `key`, `description` and `accessExpiresAt`.

## Composables

| Composable | Returns |
|---|---|
| `useWallet()` | `wallet` (`address`, `isConnected`, `isLoading`, `error`), `connect()`, `disconnect()` |
| `useX402Payment()` | `pay(url, init?)` — `fetch` with automatic 402 handling; `quote(url, init?)` — the price from the 402 challenge without paying (`amountFormatted`, `networkName`, `description`, ...); `isPaying`, `error` |

`init` is a normal `fetch` `RequestInit` plus `amount`, the payer-chosen amount for `{ min, max }` routes. Pass the same `init` to `quote()` and `pay()` so the server quotes the same purchase.

The paying wallet needs USDC on the route's network. For Base Sepolia, get test USDC from the [Circle faucet](https://faucet.circle.com).

## Playground

The playground has one example per pricing mode:

| Page | Mode | Files |
|---|---|---|
| `/protected` | Fixed price in `nuxt.config`, unlocked for 24 h | `server/api/premium.ts` |
| `/donate` | Payer-chosen amount from an input field | `server/api/donate.post.ts`, route in `nuxt.config.ts` |
| `/articles` | Computed price for each article, each unlocked on its own | `server/api/articles/[slug].get.ts` |
| `/shop` | Computed order total, each order paid once | `server/api/orders.post.ts`, `server/api/orders/[id]/pay.post.ts` |

## Development

```bash
npm install
npm run dev     # playground at http://localhost:3000, reads .env from the repo root
npm run build
```

## License

MIT
