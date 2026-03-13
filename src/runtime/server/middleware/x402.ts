import {
  defineEventHandler,
  getRequestHeader,
  setResponseHeader,
  getRequestURL,
  createError,
} from 'h3'
import {useRuntimeConfig} from '#imports'
import {getAddress} from 'viem'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const x402Config = config.x402

  if (!x402Config?.protectedRoutes?.length) {
    return
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
    return
  }

  // -- Shared payment requirements --------------------------------------------
  const paymentRequirements = {
    scheme: 'exact',
    network: 'eip155:84532',
    price: '$0.01',
    payTo: getAddress('0xD8Ae4038D01Ed0E418B3B1f10878502828725150'),
    resource: `${url.origin}${url.pathname}`,
    description: `Payment required for ${url.pathname}`,
    mimeType: 'application/json',
  }

  console.log('[x402] Protected route matched:', pathname)
  console.log('[x402] paymentRequirements:', JSON.stringify(paymentRequirements, null, 2))

  // -- Check for x-payment header ---------------------------------------------
  const paymentHeader = getRequestHeader(event, 'x-payment')

  if (!paymentHeader) {
    console.log('[x402] No x-payment header — returning 402 challenge')
    setResponseHeader(event, 'Content-Type', 'application/json')
    event.node.res.statusCode = 402
    event.node.res.statusMessage = 'Payment Required'

    return {
      error: 'Payment required to access this resource.',
      accepts: [paymentRequirements],
    }
  }

  console.log('[x402] x-payment header received (raw base64):', paymentHeader)

  // -- Verify + Settle via facilitator ----------------------------------------
  try {
    let parsed: unknown
    try {
      parsed = JSON.parse(atob(paymentHeader))
      console.log('[x402] Decoded payment payload:', JSON.stringify(parsed, null, 2))
    } catch (decodeErr) {
      console.error('[x402] Failed to decode x-payment header:', decodeErr)
      throw createError({statusCode: 400, statusMessage: 'Invalid x-payment header encoding'})
    }

    // Step 1: Verify
    const verifyBody = {paymentPayload: parsed, paymentRequirements: paymentRequirements}
    console.log('[x402] Sending to /verify:', JSON.stringify(verifyBody, null, 2))

    const verifyResponse = await $fetch(`${x402Config.facilitatorUrl}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CDP-API-KEY-ID': x402Config.cdpApiKeyId,
        'X-CDP-API-KEY-SECRET': x402Config.cdpApiKeySecret,
      },
      body: verifyBody,
    })

    console.log('[x402] /verify response:', JSON.stringify(verifyResponse, null, 2))

    if (!verifyResponse.isValid) {
      console.warn('[x402] Payment invalid:', verifyResponse.invalidReason)
      throw createError({
        statusCode: 402,
        statusMessage: 'Payment Required',
        data: {
          error: 'Payment verification failed.',
          invalidReason: verifyResponse.invalidReason,
        },
      })
    }

    // Step 2: Settle
    const settleBody = {paymentPayload: parsed, paymentRequirements: paymentRequirements}
    console.log('[x402] Sending to /settle:', JSON.stringify(settleBody, null, 2))

    const settleResponse = await $fetch<{
      success: boolean
      txHash?: string
      error?: string
    }>(`${x402Config.facilitatorUrl}/settle`, {
      method: 'POST',
      body: settleBody,
    }).catch((err) => {
      console.error('[x402] /settle HTTP error:', err?.response?.status, err?.data ?? err?.message)
      throw err
    })

    console.log('[x402] /settle response:', JSON.stringify(settleResponse, null, 2))

    if (!settleResponse.success) {
      console.warn('[x402] Settlement failed:', settleResponse.error)
      throw createError({
        statusCode: 402,
        statusMessage: 'Payment settlement failed',
        data: {error: settleResponse.error},
      })
    }

    event.context.x402 = {
      valid: true,
      scheme: 'exact',
      txHash: settleResponse.txHash,
      payer: (parsed as any)?.payload?.authorization?.from,
    }

    console.log('[x402] Payment settled successfully. txHash:', settleResponse.txHash)

    setResponseHeader(event, 'X-PAYMENT-RESPONSE', JSON.stringify({
      success: true,
      txHash: settleResponse.txHash,
    }))

  } catch (err: unknown) {
    if ((err as any).statusCode === 402) throw err
    const message = err instanceof Error ? err.message : 'Unknown verification error'
    console.error('[x402] Unhandled error:', err)
    throw createError({
      statusCode: 502,
      statusMessage: `x402: Facilitator verification failed -- ${message}`,
    })
  }
})
