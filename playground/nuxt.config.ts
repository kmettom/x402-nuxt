export default defineNuxtConfig({
  modules: ['../src/module'],

  x402: {
    facilitatorUrl: 'https://api.cdp.coinbase.com/platform/v2/x402',
    // Routes with a price that doesn't depend on the request can be declared here.
    // Prices computed per request (articles, shop orders) use defineX402Handler in the route file.
    routes: {
      // 1. Fixed price: same amount for everyone, access kept for 24 h (module accessMaxAge)
      'GET /api/premium': { price: '$0.001', network: 'eip155:84532', description: 'Premium content' },
      // 2. Payer-chosen price: the donor picks the amount, the server only checks the bounds
      'POST /api/donate': { price: { min: '$0.001', max: '$10', default: '$5.0' }, description: 'Donation' },
    },
    // payTo comes from X402_PAY_TO in .env
    cdpApiKeySecret: process.env.CDP_API_KEY_SECRET,
    cdpApiKeyId: process.env.CDP_API_KEY_ID,
  },

  nitro: {
    // The playground is built from the repo root, so Vercel looks for the build in <repo>/.vercel/output,
    // not in playground/.vercel/output where the Vercel preset writes it by default.
    ...(process.env.VERCEL ? { output: { dir: '../.vercel/output' } } : {}),
  },

  devtools: { enabled: true },
  compatibilityDate: '2025-01-01',
})
