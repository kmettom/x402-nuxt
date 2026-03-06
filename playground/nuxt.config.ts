export default defineNuxtConfig({
  modules: ['../src/module'],

  x402: {
    enabled: true,
    facilitatorUrl: 'https://x402.org/facilitator',
    protectedRoutes: [
      '/api/premium',
    ],
  },

  devtools: { enabled: true },
  compatibilityDate: '2025-01-01',
})
