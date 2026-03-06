/**
 * Shared types for the nuxt-x402 module.
 */

// -- Payment protocol types ---------------------------------------------------

/** A single payment scheme option returned in the 402 challenge. */
export interface PaymentRequirement {
  /** Payment scheme identifier, e.g. "exact-evm". */
  scheme: string
  /** EIP-155 network identifier, e.g. "eip155:8453". */
  network: string
  /** Price in smallest token unit as a decimal string. */
  maxAmountRequired: string
  /** Full resource URL that the payment unlocks. */
  resource: string
  /** Human-readable description. */
  description: string
  /** Address receiving payment. */
  payTo: string
  /** Additional scheme-specific data (e.g. token contract, deadline). */
  extra?: Record<string, unknown>
}

/** Shape of the 402 challenge response body. */
export interface PaymentChallengeResponse {
  /** Payment requirements the client can choose from. */
  accepts: PaymentRequirement[]
  /** Optional human-readable error message. */
  error?: string
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
      protectedRoutes: string[]
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
