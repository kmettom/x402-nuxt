import {
  defineEventHandler,
  getRequestHeader,
  setResponseHeader,
  getRequestURL,
  createError,
} from 'h3'
import { useRuntimeConfig } from '#imports'

/**
 * Nitro server middleware that enforces x402 payment requirements.
 *
 * For each incoming request it checks whether the route matches a protected
 * route pattern. If so, it validates the `x-payment` header against the
 * facilitator service and either passes through (valid payment) or returns a
 * 402 Payment Required challenge.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const x402Config = config.x402

  if (!x402Config?.protectedRoutes?.length) {
    return // No routes to protect -- pass through
  }

  const url = getRequestURL(event)
  const pathname = url.pathname

  // -- Check if this route is protected ---------------------------------------
  const isProtected = x402Config.protectedRoutes.some((pattern: string) => {
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3)
      return pathname === prefix || pathname.startsWith(prefix + '/')
    }
    return pathname === pattern
  })

  if (!isProtected) {
    return // Not a protected route -- pass through
  }

  // -- Check for x-payment header ---------------------------------------------
  const paymentHeader = getRequestHeader(event, 'x-payment')

  if (!paymentHeader) {
    // Return 402 challenge with payment requirements
    setResponseHeader(event, 'Content-Type', 'application/json')
    event.node.res.statusCode = 402
    event.node.res.statusMessage = 'Payment Required'

    return {
      error: 'Payment required to access this resource.',
      accepts: [
        {
          scheme: 'exact-evm',
          network: 'eip155:8453',
          maxAmountRequired: '1000000',
          resource: `${url.origin}${url.pathname}`,
          description: `Payment required for ${url.pathname}`,
          payTo: '0x0000000000000000000000000000000000000000',
        },
      ],
    }
  }

  // -- Verify payment via facilitator -----------------------------------------
  // TODO: Integrate with x402 facilitator service for real payment verification.
  // This placeholder decodes the header and attaches context for downstream handlers.
  try {
    const response = await $fetch<{
      valid: boolean
      txHash?: string
      payer?: string
      invalidReason?: string
    }>(`${x402Config.facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { payment: paymentHeader },
    })

    if (!response.valid) {
      setResponseHeader(event, 'Content-Type', 'application/json')
      event.node.res.statusCode = 402
      event.node.res.statusMessage = 'Payment Required'
      return {
        error: 'Payment verification failed.',
        invalidReason: response.invalidReason,
      }
    }

    // Attach verified payment info to event context for downstream handlers
    event.context.x402 = {
      valid: true,
      scheme: 'exact-evm',
      txHash: response.txHash,
      payer: response.payer,
    }

    // Pass through to the actual route handler
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown verification error'
    throw createError({
      statusCode: 502,
      statusMessage: `x402: Facilitator verification failed -- ${message}`,
    })
  }
})
