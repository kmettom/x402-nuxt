<script setup lang="ts">
const examples = [
  {
    to: '/protected',
    title: '1. Fixed price paywall',
    text: 'One price for everyone, set in nuxt.config. Access is kept in a signed cookie for 24 hours.',
    code: `'GET /api/premium': { price: '$0.001' }`,
  },
  {
    to: '/donate',
    title: '2. Donation (payer-chosen amount)',
    text: 'The amount comes from an input field. The server only accepts it within the min/max set in nuxt.config.',
    code: `'POST /api/donate': { price: { min: '$0.001', max: '$10' } }`,
  },
  {
    to: '/articles',
    title: '3. Price per item',
    text: 'Each article has its own price, looked up on the server. Paying for one article unlocks only that article.',
    code: `defineX402Handler({ price: event => ({ amount, key: 'article:slug' }) }, handler)`,
  },
  {
    to: '/shop',
    title: '4. Shop checkout',
    text: 'The browser only says which order to pay. The server reads the order total, so the amount cannot be changed on the client. Each order is paid once.',
    code: `defineX402Handler({ price: event => ({ amount: order.total, key: 'order:id' }) }, handler)`,
  },
]
</script>

<template>
  <div style="max-width: 720px; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, sans-serif;">
    <h1>x402-nuxt Playground</h1>
    <p>Connect MetaMask (top right), then try each pricing mode. Payments use test USDC on Base Sepolia.</p>

    <NuxtLink
      v-for="example in examples"
      :key="example.to"
      :to="example.to"
      style="display: block; margin: 1rem 0; padding: 1rem; border: 1px solid #ddd; border-radius: 8px; color: inherit; text-decoration: none;"
    >
      <h2 style="margin: 0 0 0.5rem; font-size: 1.125rem;">{{ example.title }}</h2>
      <p style="margin: 0 0 0.5rem;">{{ example.text }}</p>
      <code style="font-size: 0.8rem; color: #555;">{{ example.code }}</code>
    </NuxtLink>

    <p style="font-size: 0.875rem; color: #555;">
      The <code>/api/hello</code> endpoint is not protected and returns data freely.
    </p>
  </div>
</template>
