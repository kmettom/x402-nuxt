import type { X402Quote } from '../../src/runtime/types'

export interface PremiumAccess {
  message: string
  payer?: string
  txHash?: string
  networkName?: string
  amountFormatted?: string
  explorerTxUrl?: string
  timestamp: string
  content: { title: string; paragraphs: string[] }
}

/** Paid /api/premium response, kept in state so pages/premium.vue can render it after the redirect. */
export function usePremiumAccess() {
  const access = useState<PremiumAccess | null>('premium:access', () => null)
  const { isPaying, error, pay, quote } = useX402Payment()
  const price = useState<X402Quote | null>('premium:price', () => null)

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

  return { access, price, isPaying, error, loadPrice, unlock }
}
