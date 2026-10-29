export default defineNuxtConfig({
  modules: ['../src/module'],

  x402: {
    facilitatorUrl: 'https://api.cdp.coinbase.com/platform/v2/x402',
    routes: {
      'GET /api/premium': { price: '$0.001', network: 'eip155:84532', description: 'Premium content' },
    },
    // payTo comes from X402_PAY_TO in .env
    cdpApiKeySecret: process.env.CDP_API_KEY_SECRET,
    cdpApiKeyId: process.env.CDP_API_KEY_ID,
  },

  devtools: { enabled: true },
  compatibilityDate: '2025-01-01',
})
