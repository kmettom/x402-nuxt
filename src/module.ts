import type { X402RouteConfig } from './runtime/types'
import {
  defineNuxtModule,
  addPlugin,
  addImportsDir,
  addServerHandler,
  addServerImports,
  createResolver,
} from '@nuxt/kit'

/**
 * Module options set via `nuxt.config.ts` under the `x402` key.
 */
export interface ModuleOptions {
  /** Facilitator base URL used for /verify and /settle. Defaults to the Coinbase CDP facilitator. */
  facilitatorUrl: string
  /** Set to false to disable the module. */
  enabled: boolean
  /**
   * Paid routes, keyed by "METHOD /path". Paths support `:param` and `**` wildcards.
   * Fixed price: `'GET /api/premium': { price: '$0.001' }`.
   * Payer-chosen: `'POST /api/donate': { price: { min: '$0.5', max: '$500' } }`.
   * For prices computed per request, use `defineX402Handler` in the route file instead.
   */
  routes: Record<string, X402RouteConfig>
  /** Address that receives payments. Falls back to X402_PAY_TO. */
  payTo?: string
  /** CDP API key secret (PEM EC or base64 Ed25519). Falls back to CDP_API_KEY_SECRET. */
  cdpApiKeySecret?: string
  /** CDP API key id. Falls back to CDP_API_KEY_ID. */
  cdpApiKeyId?: string
  /** Seconds a payment keeps a route unlocked, via a signed httpOnly cookie. 0 = pay on every request. */
  accessMaxAge: number
  /** Secret that signs the access cookie. Falls back to X402_ACCESS_SECRET, then a random per-process secret. */
  accessSecret?: string
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'x402-nuxt',
    configKey: 'x402',
    compatibility: {
      nuxt: '>=4.0.0',
    },
  },

  defaults: {
    enabled: true,
    facilitatorUrl: 'https://api.cdp.coinbase.com/platform/v2/x402',
    routes: {},
    accessMaxAge: 60 * 60 * 24,
  },

  setup(options, nuxt) {
    if (!options.enabled) {
      return
    }

    const { resolve } = createResolver(import.meta.url)
    const runtimeDir = resolve('./runtime')

    // ---------------------
    // Runtime config -- expose module options to server and client
    // ---------------------
    nuxt.options.runtimeConfig.x402 = {
      facilitatorUrl: options.facilitatorUrl,
      payTo: options.payTo ?? process.env.X402_PAY_TO ?? '',
      routes: options.routes,
      // Empty means no auth headers are sent (e.g. x402.org testnet facilitator)
      cdpApiKeyId: options.cdpApiKeyId ?? process.env.CDP_API_KEY_ID ?? '',
      cdpApiKeySecret: options.cdpApiKeySecret ?? process.env.CDP_API_KEY_SECRET ?? '',
      accessMaxAge: options.accessMaxAge,
      // Overridable at runtime with NUXT_X402_ACCESS_SECRET; empty means a random per-process secret
      accessSecret: options.accessSecret ?? process.env.X402_ACCESS_SECRET ?? '',
    }

    if (!nuxt.options.runtimeConfig.x402.payTo) {
      console.warn('[x402-nuxt] No payTo address configured; set X402_PAY_TO or x402.payTo. Protected routes will fail.')
    }

    if (options.facilitatorUrl.includes('api.cdp.coinbase.com') && !nuxt.options.runtimeConfig.x402.cdpApiKeyId) {
      console.warn('[x402-nuxt] CDP facilitator configured without CDP_API_KEY_ID / CDP_API_KEY_SECRET; requests will be rejected with 401.')
    }

    // Catch malformed prices at build time instead of on the first paid request
    const isUsd = (value: unknown) => typeof value === 'string' && /^\$?\d+(\.\d{1,6})?$/.test(value.trim())
    for (const [key, route] of Object.entries(options.routes)) {
      const price = route.price
      const valid = typeof price === 'string'
        ? isUsd(price)
        : isUsd(price?.min) && isUsd(price?.max) && (price.default === undefined || isUsd(price.default))
      if (!valid) {
        throw new Error(`[x402-nuxt] Invalid price for route "${key}": use a USD amount with at most 6 decimals ("$0.01") or { min, max, default? }.`)
      }
    }

    nuxt.options.runtimeConfig.public.x402 = {
      facilitatorUrl: options.facilitatorUrl,
    }

    // ---------------------
    // Server: x402 payment verification middleware
    // ---------------------
    addServerHandler({
      handler: resolve(runtimeDir, 'server/middleware/x402'),
      middleware: true,
    })

    // Server auto-imports: paid routes with prices decided per request
    addServerImports([
      { name: 'defineX402Handler', from: resolve(runtimeDir, 'server/utils/defineX402Handler') },
      { name: 'parseUsdPrice', from: resolve(runtimeDir, 'server/utils/x402Payment') },
    ])

    // ---------------------
    // Client: wallet plugin
    // ---------------------
    addPlugin({
      src: resolve(runtimeDir, 'plugins/x402.client'),
      mode: 'client',
    })

    // ---------------------
    // Auto-imported composables
    // ---------------------
    addImportsDir(resolve(runtimeDir, 'composables'))
  },
})