/**
 * Nuxt config for @nuxt/module-builder.
 * Used during `build` and `prepare` scripts.
 */
export default defineNuxtConfig({
  modules: ['./src/module'],

  x402: {
    enabled: true,
    facilitatorUrl: 'https://x402.org/facilitator',
    protectedRoutes: [],
  },

  devtools: { enabled: true },
  compatibilityDate: '2025-01-01',
})