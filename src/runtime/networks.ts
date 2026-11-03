import { formatUnits } from 'viem'
import type { X402Network } from './types'

/** USDC has 6 decimals: "1000" atomic units = 0.001 USDC. */
export const USDC_DECIMALS = 6

export interface X402NetworkInfo {
  /** Human-readable chain name, as MetaMask shows it. */
  name: string
  /** Block explorer base URL, without trailing slash. */
  explorerUrl: string
  /** USDC contract and its EIP-712 domain. */
  usdc: { address: string; name: string; version: string }
}

export const X402_NETWORKS: Record<X402Network, X402NetworkInfo> = {
  'eip155:84532': {
    name: 'Base Sepolia',
    explorerUrl: 'https://sepolia.basescan.org',
    usdc: { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', name: 'USDC', version: '2' },
  },
  'eip155:8453': {
    name: 'Base',
    explorerUrl: 'https://basescan.org',
    usdc: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', name: 'USD Coin', version: '2' },
  },
}

/** Network info for a CAIP-2 id, or undefined if the module doesn't know it. */
export function getNetworkInfo(network: string): X402NetworkInfo | undefined {
  return X402_NETWORKS[network as X402Network]
}

/** Formats an atomic USDC amount for display, e.g. "1000" -> "0.001 USDC". */
export function formatUsdc(amount: string | bigint): string {
  return `${formatUnits(BigInt(amount), USDC_DECIMALS)} USDC`
}
