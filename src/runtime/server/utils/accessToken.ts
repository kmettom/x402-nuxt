import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { X402PaymentContext } from '../../types'

/** Signed proof that a route was paid, stored in an httpOnly cookie so a reload doesn't require paying again. */
interface AccessTokenPayload {
  /** Route key, e.g. "GET /api/premium". */
  route: string
  /** Expiry, unix seconds. */
  exp: number
  payment: X402PaymentContext
}

let fallbackSecret: string | undefined

/** Uses the configured secret, or a random per-process one (access is then lost on server restart). */
export function resolveAccessSecret(secret: string | undefined): string {
  if (secret) return secret
  if (!fallbackSecret) {
    console.warn('[x402-nuxt] No X402_ACCESS_SECRET set; using a random secret. Paid access is lost on server restart and is not shared between instances.')
    fallbackSecret = randomBytes(32).toString('hex')
  }
  return fallbackSecret
}

/** One cookie per paid route, so paying for one route never unlocks another. */
export function accessCookieName(route: string): string {
  return `x402_${createHash('sha256').update(route).digest('hex').slice(0, 16)}`
}

const sign = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest('base64url')

export function createAccessToken(payload: AccessTokenPayload, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${data}.${sign(data, secret)}`
}

/** Returns the payment the token proves, or null if it is tampered with, expired or for another route. */
export function readAccessToken(token: string | undefined, route: string, secret: string): (X402PaymentContext & { accessExpiresAt: number }) | null {
  if (!token) return null
  const [data, signature] = token.split('.')
  if (!data || !signature) return null

  const expected = Buffer.from(sign(data, secret))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as AccessTokenPayload
    if (payload.route !== route || payload.exp * 1000 <= Date.now()) return null
    return { ...payload.payment, accessExpiresAt: payload.exp }
  }
  catch {
    return null
  }
}
