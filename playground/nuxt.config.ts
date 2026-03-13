export default defineNuxtConfig({
  modules: ['../src/module'],

  x402: {
    facilitatorUrl: 'https://api.cdp.coinbase.com/platform/v2/x402',
    protectedRoutes: ['/api/premium'],
    payTo: '0xD8Ae4038D01Ed0E418B3B1f10878502828725150',
    cdpApiKeySecret: process.env.CDP_API_KEY_SECRET,
    cdpApiKeyId: process.env.CDP_API_KEY_ID,
  },

  devtools: { enabled: true },
  compatibilityDate: '2025-01-01',
})
