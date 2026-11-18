// server/middleware/x402.ts
import { defineEventHandler, getRequestURL } from 'h3'
import { createRouter, type RadixRouter } from 'radix3'
import { useRuntimeConfig } from '#imports'
import type { X402RouteConfig } from '../../types'
import { handleX402Payment } from '../utils/x402Payment'

// Routes from nuxt.config, keyed "/METHOD/path" so radix3 can match `:params` and `**` wildcards per method
let router: RadixRouter<{ config: X402RouteConfig }> | undefined
let routerSource: Record<string, X402RouteConfig> | undefined

function getRouter(routes: Record<string, X402RouteConfig>) {
  if (router && routerSource === routes) return router
  router = createRouter()
  for (const [key, config] of Object.entries(routes)) {
    const [method, ...path] = key.trim().split(/\s+/)
    if (!method || !path.length) {
      console.warn(`[x402-nuxt] Ignoring route "${key}": use "METHOD /path".`)
      continue
    }
    router.insert(`/${method.toUpperCase()}${path.join(' ')}`, { config })
  }
  routerSource = routes
  return router
}

/** Protects the routes declared under `x402.routes` in nuxt.config. */
export default defineEventHandler(async (event) => {
  const { routes } = useRuntimeConfig(event).x402 ?? {}
  if (!routes || !Object.keys(routes).length) return

  const { pathname } = getRequestURL(event)
  const match = getRouter(routes).lookup(`/${event.method}${pathname}`)
  if (!match) return

  // Returning the 402 challenge ends the request; undefined lets the paid request through
  return await handleX402Payment(event, match.config)
})
