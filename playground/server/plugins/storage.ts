import upstashDriver from 'unstorage/drivers/upstash'

/**
 * Mounts shop orders on Upstash Redis when its credentials are set, so orders survive across serverless instances.
 * Accepts both the Upstash names and the KV_* names the Vercel marketplace integration sets.
 * Without credentials, orders stay in memory (fine locally, unreliable on Vercel).
 */
export default defineNitroPlugin(() => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

  if (url && token) {
    // Pending orders that are never paid expire after a day
    useStorage().mount('orders', upstashDriver({ url, token, base: 'x402-playground:orders', ttl: 60 * 60 * 24 }))
  }
  else if (process.env.VERCEL) {
    console.warn('[playground] No Upstash Redis configured; shop orders are kept in memory and may be lost between requests.')
  }
})
