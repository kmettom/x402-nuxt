// Coinbase Developer Platform (CDP) API authentication.
// Every request needs `Authorization: Bearer <JWT>`, signed with the API key secret
// and scoped to a single "METHOD host/path" URI. Tokens expire after 2 minutes.
// https://docs.cdp.coinbase.com/api-reference/v2/authentication
import { createPrivateKey, randomBytes, sign, type KeyObject } from 'node:crypto'

const base64url = (input: Buffer | string) => Buffer.from(input).toString('base64url')

function loadKey(apiKeySecret: string): { key: KeyObject; alg: 'ES256' | 'EdDSA' } {
  // ECDSA keys are PEM; env vars often carry escaped newlines
  if (apiKeySecret.includes('BEGIN')) {
    return { key: createPrivateKey(apiKeySecret.replace(/\\n/g, '\n')), alg: 'ES256' }
  }

  // Ed25519 keys are base64 of 64 bytes: 32-byte seed + 32-byte public key
  const raw = Buffer.from(apiKeySecret, 'base64')
  if (raw.length !== 64) {
    throw new Error('Invalid CDP API key secret: expected a PEM EC key or a base64 Ed25519 key.')
  }
  const key = createPrivateKey({
    key: { kty: 'OKP', crv: 'Ed25519', d: base64url(raw.subarray(0, 32)), x: base64url(raw.subarray(32)) },
    format: 'jwk',
  })
  return { key, alg: 'EdDSA' }
}

export function generateCdpJwt(apiKeyId: string, apiKeySecret: string, method: string, url: string): string {
  const { key, alg } = loadKey(apiKeySecret)
  const { host, pathname } = new URL(url)
  const now = Math.floor(Date.now() / 1000)

  const header = { alg, kid: apiKeyId, typ: 'JWT', nonce: randomBytes(16).toString('hex') }
  const claims = {
    sub: apiKeyId,
    iss: 'cdp',
    uris: [`${method.toUpperCase()} ${host}${pathname}`],
    iat: now,
    nbf: now,
    exp: now + 120,
  }

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`
  const signature = alg === 'ES256'
    ? sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' })
    : sign(null, Buffer.from(signingInput), key)

  return `${signingInput}.${base64url(signature)}`
}

/** Auth headers for a CDP request, or none when no API key is configured (e.g. x402.org testnet facilitator). */
export function cdpAuthHeaders(
  apiKeyId: string | undefined,
  apiKeySecret: string | undefined,
  method: string,
  url: string,
): Record<string, string> {
  if (!apiKeyId || !apiKeySecret) return {}
  return { Authorization: `Bearer ${generateCdpJwt(apiKeyId, apiKeySecret, method, url)}` }
}
