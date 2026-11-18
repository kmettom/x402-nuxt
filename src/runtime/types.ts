/**
 * Shared types for the x402-nuxt module.
 */

import type { H3Event } from 'h3'

// -- Module config --------------------------------------------------------------

/** Networks the module knows the USDC contract for. */
export type X402Network = 'eip155:84532' | 'eip155:8453'

/** USD price paid in USDC, e.g. "$0.001" or "0.001". At most 6 decimals. */
export type X402Price = string

/**
 * Price chosen by the payer within bounds, e.g. a donation.
 * The client sends the amount in the `X402-Amount` header (`pay(url, { amount })`); the server checks it against `min`/`max`.
 */
export interface X402OpenPrice {
  /** Lowest accepted amount, e.g. "$0.50". */
  min: X402Price
  /** Highest accepted amount, e.g. "$500". */
  max: X402Price
  /** Amount used when the client sends none, e.g. for `quote()` or restoring access. Defaults to `min`. */
  default?: X402Price
}

/** Pricing for one paid route declared in `nuxt.config`. */
export interface X402RouteConfig {
  /** Fixed USD price (e.g. "$0.001"), or bounds for a payer-chosen amount. */
  price: X402Price | X402OpenPrice
  /** CAIP-2 network: Base Sepolia (default) or Base mainnet. */
  network?: X402Network
  /** Shown to the client in the 402 challenge. */
  description?: string
  /**
   * Seconds a payment keeps the route unlocked (via a signed cookie); 0 = pay per request.
   * Defaults to the module `accessMaxAge` for fixed prices and to 0 for payer-chosen prices.
   */
  accessMaxAge?: number
}

/** Price computed on the server for one request, returned by a `defineX402Handler` price function. */
export interface X402ResolvedPrice {
  /** USD amount paid in USDC, e.g. "$42.10". */
  amount: X402Price | number
  /**
   * Identifies what is being paid for, e.g. "order:123" or "article:intro".
   * Access cookies are scoped to route + key, so paying for one item never unlocks another.
   */
  key?: string
  /** Shown to the client in the 402 challenge. Overrides the handler `description`. */
  description?: string
  /** Overrides the handler `network`. */
  network?: X402Network
  /** Overrides the handler `accessMaxAge`. */
  accessMaxAge?: number
}

/** Price function for `defineX402Handler`. Runs on the 402 challenge and again on the paid retry. */
export type X402PriceResolver = (event: H3Event) => X402Price | number | X402ResolvedPrice | Promise<X402Price | number | X402ResolvedPrice>

/** Options for `defineX402Handler`. */
export interface X402HandlerOptions {
  /** Fixed price, payer-chosen bounds, or a function computing the price from the request (database, cart, ...). */
  price: X402Price | X402OpenPrice | X402PriceResolver
  /** CAIP-2 network: Base Sepolia (default) or Base mainnet. */
  network?: X402Network
  /** Shown to the client in the 402 challenge. */
  description?: string
  /**
   * Seconds a payment keeps the route (and `key`) unlocked; 0 = pay per request.
   * Defaults to the module `accessMaxAge` for fixed prices, and to 0 for payer-chosen or computed prices.
   */
  accessMaxAge?: number
}

// -- Payment protocol types ---------------------------------------------------

/** The protected resource described in a 402 challenge (x402 v2). */
export interface ResourceInfo {
  url: string
  description?: string
  mimeType?: string
}

/** A single payment scheme option returned in the 402 challenge (x402 v2). */
export interface PaymentRequirement {
  scheme: string
  /** CAIP-2 network id, e.g. "eip155:84532". */
  network: string
  /** Amount in the asset's atomic units (USDC: 6 decimals). */
  amount: string
  asset: string
  payTo: string
  maxTimeoutSeconds: number
  /** Scheme specific data; for EVM "exact" the token's EIP-712 domain name/version. */
  extra: Record<string, unknown>
}

/** 402 challenge, sent base64-encoded in the `PAYMENT-REQUIRED` header (and as the body). */
export interface PaymentRequired {
  x402Version: number
  /** Optional human-readable error message. */
  error?: string
  resource: ResourceInfo
  /** Payment requirements the client can choose from. */
  accepts: PaymentRequirement[]
  extensions?: Record<string, unknown>
}

/** Signed payment, sent base64-encoded in the `PAYMENT-SIGNATURE` header. */
export interface PaymentPayload {
  x402Version: number
  resource?: ResourceInfo
  /** The requirement from `accepts` the client chose to pay. */
  accepted: PaymentRequirement
  payload: Record<string, unknown>
  extensions?: Record<string, unknown>
}

/** Facilitator `/verify` response. */
export interface VerifyResponse {
  isValid: boolean
  invalidReason?: string
  invalidMessage?: string
  payer?: string
}

/** Facilitator `/settle` response, returned base64-encoded in the `PAYMENT-RESPONSE` header. */
export interface SettleResponse {
  success: boolean
  errorReason?: string
  payer?: string
  transaction: string
  network: string
}

/** Settled payment attached to `event.context.x402` by the server middleware. */
export interface X402PaymentContext {
  /** Settlement transaction hash, submitted by the facilitator. */
  txHash: string
  /** Address of the payer. */
  payer?: string
  /** CAIP-2 network id, e.g. "eip155:84532". */
  network: string
  /** Human-readable network name, e.g. "Base Sepolia". */
  networkName: string
  /** Amount in USDC atomic units (6 decimals), e.g. "1000". */
  amount: string
  /** Amount for display, e.g. "0.001 USDC". */
  amountFormatted: string
  /** Block explorer link to the settlement transaction. */
  explorerTxUrl?: string
  /** When the paid access expires (unix seconds). Set when access is kept in a cookie. */
  accessExpiresAt?: number
  /** What was paid for, as returned by the price function (e.g. "order:123"). */
  key?: string
  /** Description from the 402 challenge. */
  description?: string
}

/** Decoded and verified payment result. */
export interface PaymentResult {
  /** Whether the payment was successfully verified. */
  valid: boolean
  /** The payment scheme that was used. */
  scheme: string
  /** Network the payment was made on. */
  network: string
  /** Transaction hash or payment identifier. */
  txHash?: string
  /** Address of the payer. */
  payer?: string
  /** Reason for rejection when valid is false. */
  invalidReason?: string
}

/** Price of a paid route, read from its 402 challenge. */
export interface X402Quote {
  /** CAIP-2 network id, e.g. "eip155:84532". */
  network: string
  /** Human-readable network name, e.g. "Base Sepolia". Falls back to the CAIP-2 id. */
  networkName: string
  /** Amount in USDC atomic units (6 decimals), e.g. "1000". */
  amount: string
  /** Amount for display, e.g. "0.001 USDC". */
  amountFormatted: string
  /** Address that receives the payment. */
  payTo: string
  /** Description from the 402 challenge. */
  description?: string
}

/** `fetch` options for `pay()` and `quote()`. */
export interface X402RequestInit extends RequestInit {
  /**
   * Amount the payer chooses, e.g. "5" or "$5", for routes with a payer-chosen price.
   * Sent in the `X402-Amount` header; routes with a fixed or computed price ignore it.
   */
  amount?: string | number
}

/** Reactive wallet state exposed by composables. */
export interface WalletState {
  /** Connected wallet address, or empty string. */
  address: string
  /** Whether a wallet is currently connected. */
  isConnected: boolean
  /** Whether a wallet connection/signing operation is in progress. */
  isLoading: boolean
  /** Last error message, or null. */
  error: string | null
}

// -- EIP-1193 minimal type ----------------------------------------------------

/** Minimal EIP-1193 provider interface for MetaMask interaction. */
export interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  on?(event: string, handler: (...args: unknown[]) => void): void
}

// -- Augment Nuxt types -------------------------------------------------------

declare module 'nuxt/schema' {
  interface RuntimeConfig {
    x402: {
      facilitatorUrl: string
      routes: Record<string, X402RouteConfig>
      payTo:string
      cdpApiKeyId:string
      cdpApiKeySecret:string
      accessMaxAge: number
      accessSecret: string
    }
  }
  interface PublicRuntimeConfig {
    x402: {
      facilitatorUrl: string
    }
  }
}

declare module 'h3' {
  interface H3EventContext {
    x402?: X402PaymentContext
  }
}

declare module '#app' {
  interface NuxtApp {
    $x402: {
      facilitatorUrl: string
    }
  }
}

export {}
