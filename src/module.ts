import type { X402RouteConfig } from './runtime/types'
import {
  defineNuxtModule,
  addPlugin,
  addImportsDir,
  addServerHandler,
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
  /** Paid routes, keyed by "METHOD /path", e.g. `'GET /api/premium': { price: '$0.001' }`. */
  routes: Record<string, X402RouteConfig>
  /** Address that receives payments. Falls back to X402_PAY_TO. */
  payTo?: string
  /** CDP API key secret (PEM EC or base64 Ed25519). Falls back to CDP_API_KEY_SECRET. */
  cdpApiKeySecret?: string
  /** CDP API key id. Falls back to CDP_API_KEY_ID. */
  cdpApiKeyId?: string
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
    }

    if (!nuxt.options.runtimeConfig.x402.payTo) {
      console.warn('[x402-nuxt] No payTo address configured; set X402_PAY_TO or x402.payTo. Protected routes will fail.')
    }

    if (options.facilitatorUrl.includes('api.cdp.coinbase.com') && !nuxt.options.runtimeConfig.x402.cdpApiKeyId) {
      console.warn('[x402-nuxt] CDP facilitator configured without CDP_API_KEY_ID / CDP_API_KEY_SECRET; requests will be rejected with 401.')
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