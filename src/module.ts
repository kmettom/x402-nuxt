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
  /** URL of the x402 facilitator service. @default "https://x402.org/facilitator" */
  facilitatorUrl: string
  /** Array of route path patterns to protect with x402 payment verification. */
  protectedRoutes: string[]
  /** Enable or disable the module entirely. @default true */
  enabled: boolean
}

/**
 * nuxt-x402 -- Nuxt 3 module for the x402 HTTP payment protocol.
 *
 * Provides server-side route protection via a Nitro middleware that enforces
 * HTTP 402 payment requirements, and client-side composables for MetaMask
 * wallet connection and payment header construction.
 */
export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-x402',
    configKey: 'x402',
    compatibility: {
      nuxt: '>=3.0.0',
    },
  },

  defaults: {
    enabled: true,
    facilitatorUrl: 'https://x402.org/facilitator',
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
      protectedRoutes: options.protectedRoutes,
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