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
  facilitatorUrl: string
  protectedRoutes: string[]
  enabled: boolean
  network: string
  amount: string
  payTo: string
  /** CDP API key secret (PEM EC or base64 Ed25519). Falls back to CDP_API_KEY_SECRET. */
  cdpApiKeySecret?: string
  /** CDP API key id. Falls back to CDP_API_KEY_ID. */
  cdpApiKeyId?: string
  // routes: string[]
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-x402',
    configKey: 'x402',
    compatibility: {
      nuxt: '>=4.0.0',
    },
  },

  defaults: {
    enabled: true,
    facilitatorUrl: 'https://api.cdp.coinbase.com/platform/v2/x402',
    protectedRoutes: [],
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
      payTo: options.payTo,
      protectedRoutes: options.protectedRoutes,
      // Empty means no auth headers are sent (e.g. x402.org testnet facilitator)
      cdpApiKeyId: options.cdpApiKeyId ?? process.env.CDP_API_KEY_ID ?? '',
      cdpApiKeySecret: options.cdpApiKeySecret ?? process.env.CDP_API_KEY_SECRET ?? '',
    }

    if (options.facilitatorUrl.includes('api.cdp.coinbase.com') && !nuxt.options.runtimeConfig.x402.cdpApiKeyId) {
      console.warn('[nuxt-x402] CDP facilitator configured without CDP_API_KEY_ID / CDP_API_KEY_SECRET; requests will be rejected with 401.')
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