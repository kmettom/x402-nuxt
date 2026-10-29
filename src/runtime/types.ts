/**
 * Shared types for the nuxt-x402 module.
 */

// -- Module config --------------------------------------------------------------

/** Networks the module knows the USDC contract for. */
export type X402Network = 'eip155:84532' | 'eip155:8453'

/** Pricing for one paid route. */
export interface X402RouteConfig {
  /** USD price paid in USDC, e.g. "$0.001". */
  price: string
  /** CAIP-2 network: Base Sepolia (default) or Base mainnet. */
  network?: X402Network
  /** Shown to the client in the 402 challenge. */
  description?: string
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

/** Decoded and verified payment result attached to `event.context.x402`. */
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
    }
  }
  interface PublicRuntimeConfig {
    x402: {
      facilitatorUrl: string
    }
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
