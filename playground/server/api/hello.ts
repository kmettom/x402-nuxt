/**
 * Simple unprotected API endpoint.
 * This route is NOT behind x402 payment -- it returns data freely.
 */
export default defineEventHandler(() => {
  return {
    message: 'Hello from x402-nuxt playground!',
    timestamp: new Date().toISOString(),
    protected: false,
  }
})