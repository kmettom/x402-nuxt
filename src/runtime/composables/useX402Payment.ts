import { ref } from 'vue'
import { useState } from '#imports'
import type { PaymentChallengeResponse, PaymentRequirement, WalletState, EIP1193Provider } from '../types'

/**
 * Composable for performing x402 payment flows.
 *
 * Wraps `fetch` to automatically handle 402 Payment Required responses:
 * 1. Detect 402 and parse payment requirements from the response body.
 * 2. Sign the payment using the connected MetaMask wallet.
 * 3. Retry the original request with the `x-payment` header attached.
 *
 * @param amount - Payment amount in smallest token unit (e.g. wei).
 * @param currency - Token symbol or contract address.
 * @param recipient - EVM address receiving payment.
 */
export function useX402Payment() {
  const isPaying = ref(false)
  const error = ref<string | null>(null)

  const wallet = useState<WalletState>('x402:wallet', () => ({
    address: '',
    isConnected: false,
    isLoading: false,
    error: null,
  }))

  /**
   * Sign a payment requirement using MetaMask.
   * Constructs the x-payment header payload and signs it via personal_sign.
   *
   * @param requirement - The payment requirement from the 402 challenge.
   * @returns A base64-encoded payment header string.
   */
  async function signPayment(requirement: PaymentRequirement): Promise<string> {
    if (!import.meta.client) {
      throw new Error('signPayment can only be called on the client.')
    }

    const ethereum = (window as unknown as { ethereum?: EIP1193Provider }).ethereum
    if (!ethereum) {
      throw new Error('MetaMask is not available. Please install MetaMask to make payments.')
    }

    // TODO: Replace personal_sign with EIP-712 typed data signing via viem
    // for proper ExactEvmScheme compliance.
    const payload = {
      scheme: requirement.scheme,
      network: requirement.network,
      resource: requirement.resource,
      amount: requirement.maxAmountRequired,
      payTo: requirement.payTo,
      payer: wallet.value.address,
      timestamp: Date.now(),
    }

    const message = JSON.stringify(payload)

    const signature = await ethereum.request({
      method: 'personal_sign',
      params: [message, wallet.value.address],
    }) as string

    const paymentData = { ...payload, signature }
    return btoa(JSON.stringify(paymentData))
  }

  /**
   * Fetch a resource with automatic 402 payment handling.
   *
   * If the server responds with 402, prompts the user to sign a payment
   * via MetaMask and retries with the `x-payment` header.
   *
   * @param url - The URL to fetch.
   * @param options - Standard fetch RequestInit options.
   * @returns The final Response after payment (if required).
   */
  async function pay(url: string, options: RequestInit = {}): Promise<Response> {
    error.value = null
    const response = await fetch(url, options)

    if (response.status !== 402) {
      return response
    }

    // Handle 402 challenge
    isPaying.value = true

    try {
      const challenge: PaymentChallengeResponse = await response.json()

      if (!challenge.accepts?.length) {
        throw new Error('Server returned 402 but provided no payment requirements.')
      }

      // Ensure wallet is connected
      if (!wallet.value.isConnected) {
        throw new Error('Wallet must be connected before making a payment. Call useWallet().connect() first.')
      }

      // Sign the first accepted payment scheme
      const requirement = challenge.accepts[0]
      const paymentHeader = await signPayment(requirement)

      // Retry with payment header
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          'x-payment': paymentHeader,
        },
      })

      return retryResponse
    }
    catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment failed'
      error.value = message
      throw err
    }
    finally {
      isPaying.value = false
    }
  }

  return {
    /** Whether a payment signing/retry cycle is in progress. */
    isPaying,
    /** Last error from a payment attempt, or null. */
    error,
    /** Fetch with automatic 402 payment handling. */
    pay,
  }
}