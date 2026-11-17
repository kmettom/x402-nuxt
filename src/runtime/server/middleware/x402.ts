// server/middleware/x402.ts
import { defineEventHandler, getCookie, getRequestHeader, setCookie, setResponseHeader, setResponseStatus, getRequestURL, createError } from 'h3'
import { getAddress, parseUnits } from 'viem'
import { useRuntimeConfig } from '#imports'
import type { PaymentPayload, PaymentRequired, PaymentRequirement, SettleResponse, VerifyResponse, X402PaymentContext } from '../../types'
import { X402_NETWORKS, USDC_DECIMALS, formatUsdc } from '../../networks'
import { cdpAuthHeaders } from '../utils/cdpAuth'
import { accessCookieName, createAccessToken, readAccessToken, resolveAccessSecret } from '../utils/accessToken'

const X402_VERSION = 2

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64')

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const { facilitatorUrl, payTo, routes, cdpApiKeyId, cdpApiKeySecret, accessMaxAge, accessSecret } = config.x402 ?? {}

  const url = getRequestURL(event)
  const routeKey = `${event.method} ${url.pathname}`
  const route = routes?.[routeKey]

  if (!route) return

  // Already paid: a valid access cookie lets the request through without a new payment
  const maxAge = route.accessMaxAge ?? accessMaxAge ?? 0
  const cookieName = accessCookieName(routeKey)
  if (maxAge > 0) {
    const paid = readAccessToken(getCookie(event, cookieName), routeKey, resolveAccessSecret(accessSecret))
    if (paid) {
      event.context.x402 = paid
      return
    }
  }

  if (!payTo) {
    throw createError({ statusCode: 500, statusMessage: 'x402 payTo address not configured', message: 'Set X402_PAY_TO in .env or x402.payTo in nuxt.config.' })
  }

  const network = route.network ?? 'eip155:84532'
  const networkInfo = X402_NETWORKS[network]
  if (!networkInfo) {
    throw createError({ statusCode: 500, statusMessage: 'x402 network not supported', message: `Unsupported network "${network}" for ${routeKey}.` })
  }

  const paymentRequirements: PaymentRequirement = {
    scheme: 'exact',
    network,
    // USDC has 6 decimals: $0.001 -> "1000"
    amount: parseUnits(route.price.replace('$', ''), USDC_DECIMALS).toString(),
    asset: networkInfo.usdc.address,
    payTo: getAddress(payTo),
    maxTimeoutSeconds: 300,
    // EIP-712 domain of the USDC contract
    extra: { name: networkInfo.usdc.name, version: networkInfo.usdc.version },
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

  const payment: X402PaymentContext = {
    txHash: settleResponse.transaction,
    payer: settleResponse.payer ?? verifyResponse.payer,
    network,
    networkName: networkInfo.name,
    amount: paymentRequirements.amount,
    amountFormatted: formatUsdc(paymentRequirements.amount),
    explorerTxUrl: settleResponse.transaction ? `${networkInfo.explorerUrl}/tx/${settleResponse.transaction}` : undefined,
  }
  event.context.x402 = payment

  setResponseHeader(event, 'PAYMENT-RESPONSE', encode(settleResponse))

  if (maxAge > 0) {
    const exp = Math.floor(Date.now() / 1000) + maxAge
    event.context.x402.accessExpiresAt = exp
    setCookie(event, cookieName, createAccessToken({ route: routeKey, exp, payment }, resolveAccessSecret(accessSecret)), {
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge,
    })
  }
})

function facilitatorError(err: any): string {
  const data = err?.data
  if (typeof data === 'string') return data
  return data?.errorMessage ?? data?.error ?? err?.message ?? 'unknown error'
}
