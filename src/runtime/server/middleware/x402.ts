import {
  defineEventHandler,
  getRequestHeader,
  setResponseHeader,
  getRequestURL,
  createError,
} from 'h3'
import {useRuntimeConfig} from '#imports'
import {getAddress} from "viem";

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

  console.log("defineEventHandler")
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

  console.log("paymentHeader, ", paymentHeader)

  if (!paymentHeader) {
    console.log("!paymentHeader !!!")
    // Return 402 challenge with payment requirements
    setResponseHeader(event, 'Content-Type', 'application/json')
    event.node.res.statusCode = 402
    event.node.res.statusMessage = 'Payment Required'

    const addressPayTo = getAddress('0xD8Ae4038D01Ed0E418B3B1f10878502828725150')
    const addressPayer = getAddress('0xcde753d46195e2c80f43db01c399eed8f79433c6')

    return {
      error: 'Payment required to access this resource.',
      accepts: [
        {
          scheme: 'exact-evm',
          network: 'eip155:84532', // base sepolia
          maxAmountRequired: '10000',
          resource: `${url.origin}${url.pathname}`,
          description: `Payment required for ${url.pathname}`,
          payTo: addressPayTo,
          payer: addressPayer,
        },
      ],
    }
  }

  console.log("after PaymentHeader")

  // -- Verify payment via facilitator -----------------------------------------
  // TODO: Integrate with x402 facilitator service for real payment verification.
  // This placeholder decodes the header and attaches context for downstream handlers.
  try {
    const parsed = JSON.parse(atob(paymentHeader)) // decode base64 → object
    console.log("parsed", parsed)
    console.log("x402Config.facilitatorUrl", x402Config.facilitatorUrl)

    const response = await $fetch<{
      valid: boolean
      txHash?: string
      payer?: string
      invalidReason?: string
    }>(`${x402Config.facilitatorUrl}/verify`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: parsed, // send decoded object directly
    })

    console.log("response response x", response)

    if (!response.valid) {
      throw createError({
        statusCode: 402,
        statusMessage: 'Payment Required',
        data: {
          error: 'Payment verification failed.',
          invalidReason: response.invalidReason,
        },
      })
    }

    // Attach to context for downstream route handlers
    event.context.x402 = {
      valid: true,
      scheme: 'exact-evm',
      txHash: response.txHash,
      payer: response.payer,
    }

    // Attach receipt header for client confirmation
    if (response.txHash) {
      setResponseHeader(event, 'X-PAYMENT-RESPONSE', JSON.stringify({
        success: true,
        txHash: response.txHash,
      }))
    }

  } catch (err: unknown) {
    console.log("err", err)
    if ((err as any).statusCode === 402) throw err // re-throw known 402s
    const message = err instanceof Error ? err.message : 'Unknown verification error'
    throw createError({
      statusCode: 502,
      statusMessage: `x402: Facilitator verification failed -- ${message}`,
    })
  }

})
