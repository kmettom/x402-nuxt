import { useState } from '#imports'
import type { WalletState, EIP1193Provider } from '../types'

export function useWallet() {
  const wallet = useState<WalletState>('x402:wallet', () => ({
    address: '',
    isConnected: false,
    isLoading: false,
    error: null,
  }))

  // ✅ Sync wallet state when user switches account or disconnects in MetaMask
  if (import.meta.client) {
    const ethereum = (window as unknown as { ethereum?: EIP1193Provider }).ethereum
    ethereum?.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect()
      } else {
        wallet.value.address = accounts[0]!
        wallet.value.isConnected = true
      }
    })
    ethereum?.on('chainChanged', () => {
      // Chain changed — reload to avoid stale state
      window.location.reload()
    })
  }

  async function connect(): Promise<string | null> {
    if (!import.meta.client) return null

    const ethereum = (window as unknown as { ethereum?: EIP1193Provider }).ethereum
    if (!ethereum) {
      wallet.value.error = 'MetaMask is not installed.'
      return null
    }

    wallet.value.isLoading = true
    wallet.value.error = null

    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[]
      if (accounts.length > 0) {
        wallet.value.address = accounts[0]!
        wallet.value.isConnected = true
        return accounts[0]!
      }
      wallet.value.error = 'No accounts returned by wallet.'
      return null
    }
    catch (err: unknown) {
      wallet.value.error = err instanceof Error ? err.message : 'Wallet connection rejected'
      return null
    }
    finally {
      wallet.value.isLoading = false
    }
  }

  function disconnect(): void {
    wallet.value.address = ''
    wallet.value.isConnected = false
    wallet.value.error = null
  }

  return { wallet, connect, disconnect }
}
