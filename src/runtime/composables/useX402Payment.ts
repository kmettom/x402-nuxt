import {ref} from 'vue'
import {useState} from '#imports'
import type {EIP1193Provider, PaymentChallengeResponse, PaymentRequirement, WalletState} from '../types'

export function useX402Payment() {
  const isPaying = ref(false)
  const error = ref<string | null>(null)

  const wallet = useState<WalletState>('x402:wallet', () => ({
    address: '',
    isConnected: false,
    isLoading: false,
    error: null,
  }))

  async function signPayment(requirement: PaymentRequirement | null): Promise<string> {
    console.log("signPayment")
    if(!requirement){
      throw new Error('requirement missing.')
    }
    if (!import.meta.client) {
      throw new Error('signPayment can only be called on the client.')
    }

    const ethereum = (window as unknown as { ethereum?: EIP1193Provider }).ethereum
    if (!ethereum) {
      throw new Error('MetaMask is not available. Please install MetaMask to make payments.')
    }

    // TODO: Replace personal_sign with EIP-712 typed data signing via viem
    // for proper ExactEvmScheme compliance.

    console.log("requirement", requirement)

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

    isPaying.value = true

    try {
      const challenge: PaymentChallengeResponse = await response.json()

      if (!challenge.accepts?.length) {
        console.log('Server returned 402 but provided no payment requirements.')
      }

      if (!wallet.value.isConnected) {
        console.log('Wallet must be connected before making a payment. Call useWallet().connect() first.')
      }

      // Sign the first accepted payment scheme
      const requirement = challenge.accepts[0]
      const paymentHeader = await signPayment(requirement ?? null)

      return await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          'x-payment': paymentHeader,
        },
      })
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Payment failed'
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