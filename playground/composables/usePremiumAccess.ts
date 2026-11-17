import type { X402Quote } from '../../src/runtime/types'

export interface PremiumAccess {
  message: string
  payer?: string
  txHash?: string
  networkName?: string
  amountFormatted?: string
  explorerTxUrl?: string
  accessExpiresAt?: number
  timestamp: string
  content: { title: string; paragraphs: string[] }
}

/** Paid /api/premium response, kept in state so pages/premium.vue can render it after the redirect. */
export function usePremiumAccess() {
  const access = useState<PremiumAccess | null>('premium:access', () => null)
  const { isPaying, error, pay, quote } = useX402Payment()
  const price = useState<X402Quote | null>('premium:price', () => null)
  // Forwards the browser's cookies during SSR, so the access cookie reaches /api/premium
  const requestFetch = useRequestFetch()

  /**
   * Reloads the content when an earlier payment is still valid (the server keeps it in an httpOnly cookie).
   * Without one the route answers 402, and access stays null. Returns whether access is available.
   */
  async function restore(): Promise<boolean> {
    if (access.value) return true
    access.value = await requestFetch<PremiumAccess>('/api/premium').catch(() => null)
    return !!access.value
  }

  /** Loads the price and network from the 402 challenge, so the paywall can show them before paying. */
  async function loadPrice() {
    price.value = await quote('/api/premium').catch(() => null)
  }

  /** Pays for /api/premium and redirects to the premium page. Returns an error message on failure. */
  async function unlock(): Promise<string | null> {
    try {
      const response = await pay('/api/premium')
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        return `Error: ${response.status} ${body?.message ?? response.statusText}`
      }
      access.value = await response.json()
      await navigateTo('/premium')
      return null
    }
    catch (err: unknown) {
      return `Payment error: ${err instanceof Error ? err.message : 'Unknown error'}`
    }
  }

  return { access, price, isPaying, error, loadPrice, unlock, restore }
}
