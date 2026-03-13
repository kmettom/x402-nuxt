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
  routes: string[]
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
      payTo: options.payTo,                    // ✅ add
      routes: options.routes,                  // ✅ add (replaces protectedRoutes)
      cdpApiKeyId: '',                         // ✅ add — filled from runtimeConfig at runtime
      cdpApiKeySecret: '',                     // ✅ add
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