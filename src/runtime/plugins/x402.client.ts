import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import type { EIP1193Provider } from '../types'

/**
 * Client-only Nuxt plugin that initializes x402 payment utilities.
 *
 * Checks for MetaMask availability, sets up wallet event listeners,
 * and provides `$x402` helper via `nuxtApp.provide`.
 */
export default defineNuxtPlugin((_nuxtApp) => {
  const config = useRuntimeConfig()
  const x402Public = config.public.x402

  // Listen for MetaMask account/chain changes if available
  if (import.meta.client) {
    const ethereum = (window as unknown as { ethereum?: EIP1193Provider }).ethereum

    if (ethereum?.on) {
      ethereum.on('accountsChanged', (accounts: unknown) => {
        if (Array.isArray(accounts) && accounts.length === 0) {
          console.info('[nuxt-x402] Wallet disconnected via MetaMask.')
        }
      })

      ethereum.on('chainChanged', (_chainId: unknown) => {
        console.info('[nuxt-x402] Chain changed. You may need to refresh.')
      })
    }
    else {
      console.info('[nuxt-x402] MetaMask not detected. Wallet features will be unavailable.')
    }
  }

  return {
    provide: {
      x402: {
        facilitatorUrl: x402Public.facilitatorUrl,
      },
    },
  }
})