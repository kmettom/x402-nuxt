import { useState } from '#imports'
import type { WalletState, EIP1193Provider } from '../types'

/**
 * Composable for MetaMask / EIP-1193 wallet connection.
 *
 * Manages reactive wallet state and provides `connect` / `disconnect` helpers.
 * All `window.ethereum` access is guarded for SSR safety.
 */
export function useWallet() {
  const wallet = useState<WalletState>('x402:wallet', () => ({
    address: '',
    isConnected: false,
    isLoading: false,
    error: null,
  }))

  /**
   * Request wallet connection via MetaMask (EIP-1193 `eth_requestAccounts`).
   * Updates reactive state on success or failure.
   *
   * @returns The connected wallet address, or null if connection failed.
   */
  async function connect(): Promise<string | null> {
    if (!import.meta.client) return null

    const ethereum = (window as unknown as { ethereum?: EIP1193Provider }).ethereum
    if (!ethereum) {
      wallet.value.error = 'MetaMask is not installed. Please install it to continue.'
      return null
    }

    wallet.value.isLoading = true
    wallet.value.error = null

    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[]
      if (accounts.length > 0) {
        wallet.value.address = accounts[0]
        wallet.value.isConnected = true
        return accounts[0]
      }
      wallet.value.error = 'No accounts returned by wallet.'
      return null
    }
    catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Wallet connection rejected'
      wallet.value.error = message
      return null
    }
    finally {
      wallet.value.isLoading = false
    }
  }

  /** Clear local wallet state. Does not revoke permissions in MetaMask. */
  function disconnect(): void {
    wallet.value.address = ''
    wallet.value.isConnected = false
    wallet.value.error = null
  }

  return {
    /** Reactive wallet state. */
    wallet,
    /** Connect to MetaMask. Returns the address or null. */
    connect,
    /** Disconnect (clears local state only). */
    disconnect,
  }
}