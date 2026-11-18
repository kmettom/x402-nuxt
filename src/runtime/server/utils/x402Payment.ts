import { createError, getCookie, getRequestHeader, getRequestURL, setCookie, setResponseHeader, setResponseStatus } from 'h3'
import type { H3Event } from 'h3'
import { getAddress, isAddressEqual } from 'viem'
import { useRuntimeConfig } from '#imports'
import type {
  PaymentPayload,
  PaymentRequired,
  PaymentRequirement,
  SettleResponse,
  VerifyResponse,
  X402HandlerOptions,
  X402Network,
  X402OpenPrice,
  X402PaymentContext,
  X402Price,
  X402ResolvedPrice,
} from '../../types'
import { X402_NETWORKS, USDC_DECIMALS, formatUsdc } from '../../networks'
import { cdpAuthHeaders } from './cdpAuth'
import { accessCookieName, createAccessToken, readAccessToken, resolveAccessSecret } from './accessToken'

const X402_VERSION = 2
const DEFAULT_NETWORK: X402Network = 'eip155:84532'

/** Request header carrying a payer-chosen amount, e.g. "5" or "$5". */
export const X402_AMOUNT_HEADER = 'x402-amount'

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64')

/** Pricing for one request, after the price (fixed, payer-chosen or computed) has been resolved. */
interface ResolvedPayment {
  /** Atomic USDC units. */
  amount: bigint
  network: X402Network
  description?: string
  key?: string
  /** Seconds the payment keeps this route + key unlocked; 0 = pay per request. */
  accessMaxAge: number
}

// -- Price parsing --------------------------------------------------------------

const USD_PATTERN = new RegExp(`^\\d+(\\.\\d{1,${USDC_DECIMALS}})?$`)

/**
 * Parses a USD price ("$0.001", "0.001", 42.1) into atomic USDC units.
 * Rejects negative values, more than 6 decimals and anything that is not a plain number.
 */
export function parseUsdPrice(price: X402Price | number): bigint {
  const text = String(price).trim().replace(/^\$/, '')
  if (!USD_PATTERN.test(text)) {
    throw new Error(`Invalid USD price "${price}": use a plain amount with at most ${USDC_DECIMALS} decimals, e.g. "$0.01".`)
  }
  const [whole = '0', fraction = ''] = text.split('.')
  return BigInt(whole + fraction.padEnd(USDC_DECIMALS, '0'))
}

export function isOpenPrice(price: unknown): price is X402OpenPrice {
  return typeof price === 'object' && price !== null && 'min' in price && 'max' in price
}

/** Reads the payer-chosen amount from the `X402-Amount` header and checks it against the route's bounds. */
function resolveOpenAmount(event: H3Event, price: X402OpenPrice): bigint {
  const min = parseUsdPrice(price.min)
  const max = parseUsdPrice(price.max)
  const header = getRequestHeader(event, X402_AMOUNT_HEADER)

  if (!header) return price.default ? parseUsdPrice(price.default) : min

  let amount: bigint
  try {
    amount = parseUsdPrice(header)
  }
  catch (err) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payment amount', message: (err as Error).message })
  }
  if (amount < min || amount > max) {
    throw createError({ statusCode: 400, statusMessage: 'Payment amount out of range', message: `Amount must be between ${formatUsdc(min)} and ${formatUsdc(max)}.` })
  }
  return amount
}

/**
 * Resolves the price for this request. The amount always comes from the server:
 * fixed config, a server-side function, or a payer-chosen amount checked against server-side bounds.
 */
export async function resolvePayment(event: H3Event, options: X402HandlerOptions, moduleAccessMaxAge: number): Promise<ResolvedPayment> {
  const { price } = options
  const base = { network: options.network ?? DEFAULT_NETWORK, description: options.description }

  if (typeof price === 'string') {
    return { ...base, amount: parseUsdPrice(price), accessMaxAge: options.accessMaxAge ?? moduleAccessMaxAge }
  }

  if (isOpenPrice(price)) {
    return { ...base, amount: resolveOpenAmount(event, price), accessMaxAge: options.accessMaxAge ?? 0 }
  }

  const result = await price(event)
  const resolved: X402ResolvedPrice = typeof result === 'object' ? result : { amount: result }
  let amount: bigint
  try {
    amount = parseUsdPrice(resolved.amount)
  }
  catch (err) {
    throw createError({ statusCode: 500, statusMessage: 'x402 price function returned an invalid amount', message: (err as Error).message })
  }
  return {
    amount,
    network: resolved.network ?? base.network,
    description: resolved.description ?? base.description,
    key: resolved.key,
    accessMaxAge: resolved.accessMaxAge ?? options.accessMaxAge ?? 0,
  }
}

// -- Payment flow ---------------------------------------------------------------

/**
 * Runs the x402 flow for one request: access cookie, 402 challenge, verify and settle.
 *
 * Returns `undefined` when the request is paid (the payment is on `event.context.x402`),
 * or the 402 challenge body (status and `PAYMENT-REQUIRED` header already set) that the caller must return.
 */
export async function handleX402Payment(event: H3Event, options: X402HandlerOptions): Promise<PaymentRequired | undefined> {
  const config = useRuntimeConfig(event).x402
  const { facilitatorUrl, payTo, cdpApiKeyId, cdpApiKeySecret, accessSecret } = config

  const url = getRequestURL(event)
  const routeKey = `${event.method} ${url.pathname}`
  const resolved = await resolvePayment(event, options, config.accessMaxAge ?? 0)

  // Already paid: a valid access cookie for this route + key, covering the current price, lets the request through
  const scope = resolved.key ? `${routeKey}#${resolved.key}` : routeKey
  const cookieName = accessCookieName(scope)
  if (resolved.accessMaxAge > 0) {
    const paid = readAccessToken(getCookie(event, cookieName), scope, resolveAccessSecret(accessSecret))
    if (paid && BigInt(paid.amount) >= resolved.amount) {
      event.context.x402 = paid
      return
    }
  }

  if (!payTo) {
    throw createError({ statusCode: 500, statusMessage: 'x402 payTo address not configured', message: 'Set X402_PAY_TO in .env or x402.payTo in nuxt.config.' })
  }

  const networkInfo = X402_NETWORKS[resolved.network]
  if (!networkInfo) {
    throw createError({ statusCode: 500, statusMessage: 'x402 network not supported', message: `Unsupported network "${resolved.network}" for ${routeKey}.` })
  }

  const paymentRequirements: PaymentRequirement = {
    scheme: 'exact',
    network: resolved.network,
    amount: resolved.amount.toString(),
    asset: networkInfo.usdc.address,
    payTo: getAddress(payTo),
    maxTimeoutSeconds: 300,
    // EIP-712 domain of the USDC contract
    extra: { name: networkInfo.usdc.name, version: networkInfo.usdc.version },
  }

  const challenge = (error: string): PaymentRequired => {
    const body: PaymentRequired = {
      x402Version: X402_VERSION,
      error,
      resource: { url: url.toString(), description: resolved.description, mimeType: 'application/json' },
      accepts: [paymentRequirements],
    }
    setResponseStatus(event, 402)
    setResponseHeader(event, 'PAYMENT-REQUIRED', encode(body))
    return body
  }

  const paymentHeader = getRequestHeader(event, 'payment-signature')
  if (!paymentHeader) return challenge('Payment required.')

  let paymentPayload: PaymentPayload
  try {
    paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf8'))
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid PAYMENT-SIGNATURE encoding' })
  }

  // The signed payment must be for exactly what the server asks now. A tampered amount, or a price that
  // changed since the challenge (e.g. the cart was edited), gets a fresh challenge instead of being settled.
  if (!matchesRequirements(paymentPayload, paymentRequirements)) {
    return challenge('Payment does not match the current price. Sign the new payment requirements.')
  }

  const facilitatorBody = { x402Version: X402_VERSION, paymentPayload, paymentRequirements }

  const authHeaders = (target: string) => {
    try {
      return cdpAuthHeaders(cdpApiKeyId, cdpApiKeySecret, 'POST', target)
    }
    catch (err) {
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
    network: resolved.network,
    networkName: networkInfo.name,
    amount: paymentRequirements.amount,
    amountFormatted: formatUsdc(paymentRequirements.amount),
    explorerTxUrl: settleResponse.transaction ? `${networkInfo.explorerUrl}/tx/${settleResponse.transaction}` : undefined,
    key: resolved.key,
    description: resolved.description,
  }
  event.context.x402 = payment

  setResponseHeader(event, 'PAYMENT-RESPONSE', encode(settleResponse))

  if (resolved.accessMaxAge > 0) {
    const exp = Math.floor(Date.now() / 1000) + resolved.accessMaxAge
    payment.accessExpiresAt = exp
    setCookie(event, cookieName, createAccessToken({ route: scope, exp, payment }, resolveAccessSecret(accessSecret)), {
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: resolved.accessMaxAge,
    })
  }
}

/** Whether the client signed exactly the requirements the server issues for this request. */
function matchesRequirements(payload: PaymentPayload, required: PaymentRequirement): boolean {
  const accepted = payload?.accepted
  const authorization = payload?.payload?.authorization as { value?: string, to?: string } | undefined
  if (!accepted || !authorization?.value || !authorization.to) return false

  try {
    return accepted.scheme === required.scheme
      && accepted.network === required.network
      && BigInt(accepted.amount) === BigInt(required.amount)
      && BigInt(authorization.value) === BigInt(required.amount)
      && isAddressEqual(accepted.asset as `0x${string}`, required.asset as `0x${string}`)
      && isAddressEqual(accepted.payTo as `0x${string}`, required.payTo as `0x${string}`)
      && isAddressEqual(authorization.to as `0x${string}`, required.payTo as `0x${string}`)
  }
  catch {
    return false
  }
}

function facilitatorError(err: any): string {
  const data = err?.data
  if (typeof data === 'string') return data
  return data?.errorMessage ?? data?.error ?? err?.message ?? 'unknown error'
}
