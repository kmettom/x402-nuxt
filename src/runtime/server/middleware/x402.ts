// server/middleware/x402.ts
import { defineEventHandler, getRequestHeader, setResponseHeader, getRequestURL, createError } from 'h3'
import { getAddress } from 'viem'
import { useRuntimeConfig } from '#imports'

const ROUTES: Record<string, { price: string; network: string }> = {
  'GET /api/premium': { price: '$0.001', network: 'eip155:84532' },
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const { facilitatorUrl, payTo, cdpApiKeyId, cdpApiKeySecret } = config.x402 ?? {}

  console.log("config", config)

  const url = getRequestURL(event)
  const routeKey = `${event.method} ${url.pathname}`
  const route = ROUTES[routeKey]

  console.log("url", url)

  if (!route) return

  const paymentRequirements = {
    scheme: 'exact',
    network: route.network,
    price: route.price,
    maxAmountRequired: "100000",
    payTo: getAddress(payTo),
    resource: url.toString(),
    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC Base Sepolia
    maxTimeoutSeconds: 300,
    extra: { name: 'USDC', version: '2' },
  }

  const paymentHeader = getRequestHeader(event, 'x-payment')

  if (!paymentHeader) {
    event.node.res.statusCode = 402
    setResponseHeader(event, 'Content-Type', 'application/json')
    return { error: 'Payment required.', accepts: [paymentRequirements] }
  }

  console.log("cdpApiKeyId", cdpApiKeyId)
  console.log("cdpApiKeySecret", cdpApiKeySecret)

  // console.log('cdpApiKeyIdTest', cdpApiKeyIdTest)
  // console.log('cdpApiKeySecretTest', cdpApiKeySecretTest)

  // Build auth headers — empty if using x402.org testnet (no key needed)
  const authHeaders: Record<string, string> = cdpApiKeyId ? {
    'X-CDP-API-KEY-ID': cdpApiKeyId,
    'X-CDP-API-KEY-SECRET': cdpApiKeySecret,
  } : {}

  let parsed: unknown
  try {
    parsed = JSON.parse(atob(paymentHeader))
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid x-payment encoding' })
  }

  console.log("authHeaders", authHeaders)

  // Step 1: Verify
  const verifyResponse = await $fetch<{ isValid: boolean; invalidReason?: string }>(
    `${facilitatorUrl}/verify`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: { paymentPayload: parsed, paymentRequirements },
    }
  ).catch((err) => {
    throw createError({ statusCode: 502, statusMessage: `Facilitator verify failed: ${err?.data?.error ?? err.message}` })
  })

  if (!verifyResponse.isValid) {
    throw createError({ statusCode: 402, data: { invalidReason: verifyResponse.invalidReason } })
  }

  // Step 2: Settle
  const settleResponse = await $fetch<{ success: boolean; txHash?: string; error?: string }>(
    `${facilitatorUrl}/settle`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: { paymentPayload: parsed, paymentRequirements },
    }
  ).catch((err) => {
    throw createError({ statusCode: 502, statusMessage: `Facilitator settle failed: ${err?.data?.error ?? err.message}` })
  })

  if (!settleResponse.success) {
    throw createError({ statusCode: 402, data: { error: settleResponse.error } })
  }

  event.context.x402 = {
    txHash: settleResponse.txHash,
    payer: (parsed as any)?.payload?.authorization?.from,
  }

  setResponseHeader(event, 'X-PAYMENT-RESPONSE', JSON.stringify({
    success: true,
    txHash: settleResponse.txHash,
  }))
})
