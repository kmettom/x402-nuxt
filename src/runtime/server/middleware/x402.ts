// server/middleware/x402.ts
import { defineEventHandler, getRequestHeader, setResponseHeader, setResponseStatus, getRequestURL, createError } from 'h3'
import { getAddress, parseUnits } from 'viem'
import { useRuntimeConfig } from '#imports'
import type { PaymentPayload, PaymentRequired, PaymentRequirement, SettleResponse, VerifyResponse, X402Network } from '../../types'
import { cdpAuthHeaders } from '../utils/cdpAuth'

const X402_VERSION = 2

// USDC contract and its EIP-712 domain per network
const USDC: Record<X402Network, { address: string; name: string; version: string }> = {
  'eip155:84532': { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', name: 'USDC', version: '2' },
  'eip155:8453': { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', name: 'USD Coin', version: '2' },
}

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64')

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const { facilitatorUrl, payTo, routes, cdpApiKeyId, cdpApiKeySecret } = config.x402 ?? {}

  const url = getRequestURL(event)
  const routeKey = `${event.method} ${url.pathname}`
  const route = routes?.[routeKey]

  if (!route) return

  if (!payTo) {
    throw createError({ statusCode: 500, statusMessage: 'x402 payTo address not configured', message: 'Set X402_PAY_TO in .env or x402.payTo in nuxt.config.' })
  }

  const network = route.network ?? 'eip155:84532'
  const usdc = USDC[network]
  if (!usdc) {
    throw createError({ statusCode: 500, statusMessage: 'x402 network not supported', message: `Unsupported network "${network}" for ${routeKey}.` })
  }

  const paymentRequirements: PaymentRequirement = {
    scheme: 'exact',
    network,
    // USDC has 6 decimals: $0.001 -> "1000"
    amount: parseUnits(route.price.replace('$', ''), 6).toString(),
    asset: usdc.address,
    payTo: getAddress(payTo),
    maxTimeoutSeconds: 300,
    // EIP-712 domain of the USDC contract
    extra: { name: usdc.name, version: usdc.version },
  }

  const paymentRequired: PaymentRequired = {
    x402Version: X402_VERSION,
    resource: { url: url.toString(), description: route.description, mimeType: 'application/json' },
    accepts: [paymentRequirements],
  }

  const paymentHeader = getRequestHeader(event, 'payment-signature')

  if (!paymentHeader) {
    const body = { ...paymentRequired, error: 'Payment required.' }
    setResponseStatus(event, 402)
    setResponseHeader(event, 'PAYMENT-REQUIRED', encode(body))
    return body
  }

  let paymentPayload: PaymentPayload
  try {
    paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf8'))
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid PAYMENT-SIGNATURE encoding' })
  }

  const facilitatorBody = { x402Version: X402_VERSION, paymentPayload, paymentRequirements }

  const authHeaders = (url: string) => {
    try {
      return cdpAuthHeaders(cdpApiKeyId, cdpApiKeySecret, 'POST', url)
    } catch (err) {
      console.error('[x402] could not sign CDP request', err)
      throw createError({ statusCode: 500, statusMessage: 'Facilitator auth misconfigured', message: (err as Error).message })
    }
  }

  // Step 1: Verify
  const verifyUrl = `${facilitatorUrl}/verify`
  const verifyResponse = await $fetch<VerifyResponse>(verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(verifyUrl) },
    body: facilitatorBody,
  }).catch((err) => {
    // Facilitators answer an invalid payment with a 4xx that still carries a VerifyResponse
    if (err?.data && typeof err.data === 'object' && 'isValid' in err.data) return err.data as VerifyResponse
    console.error('[x402] verify failed', err?.status, err?.data)
    throw createError({ statusCode: 502, statusMessage: 'Facilitator verify failed', message: `Facilitator verify failed (${err?.status}): ${facilitatorError(err)}` })
  })

  if (!verifyResponse.isValid) {
    throw createError({ statusCode: 402, statusMessage: 'Payment invalid', data: { invalidReason: verifyResponse.invalidReason, invalidMessage: verifyResponse.invalidMessage } })
  }

  // Step 2: Settle
  const settleUrl = `${facilitatorUrl}/settle`
  const settleResponse = await $fetch<SettleResponse>(settleUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(settleUrl) },
    body: facilitatorBody,
  }).catch((err) => {
    if (err?.data && typeof err.data === 'object' && 'success' in err.data) return err.data as SettleResponse
    console.error('[x402] settle failed', err?.status, err?.data)
    throw createError({ statusCode: 502, statusMessage: 'Facilitator settle failed', message: `Facilitator settle failed (${err?.status}): ${facilitatorError(err)}` })
  })

  if (!settleResponse.success) {
    throw createError({ statusCode: 402, statusMessage: 'Payment settlement failed', data: { errorReason: settleResponse.errorReason } })
  }

  event.context.x402 = {
    txHash: settleResponse.transaction,
    payer: settleResponse.payer ?? verifyResponse.payer,
  }

  setResponseHeader(event, 'PAYMENT-RESPONSE', encode(settleResponse))
})

function facilitatorError(err: any): string {
  const data = err?.data
  if (typeof data === 'string') return data
  return data?.errorMessage ?? data?.error ?? err?.message ?? 'unknown error'
}
