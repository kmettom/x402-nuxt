import {ref} from 'vue'
import {useState} from '#imports'
import type {EIP1193Provider, PaymentPayload, PaymentRequired, PaymentRequirement, WalletState} from '../types'
import { createWalletClient, custom, getAddress, type Chain } from 'viem'
import { base, baseSepolia } from 'viem/chains'

const CHAINS: Record<number, Chain> = { [base.id]: base, [baseSepolia.id]: baseSepolia }

export function useX402Payment() {
  const isPaying = ref(false)
  const error = ref<string | null>(null)

  const wallet = useState<WalletState>('x402:wallet', () => ({
    address: '',
    isConnected: false,
    isLoading: false,
    error: null,
  }))


  async function signPayment(paymentRequired: PaymentRequired, requirement: PaymentRequirement): Promise<string|null> {
    if (!import.meta.client) throw new Error('signPayment can only be called on the client.')

    const ethereum = (window as unknown as { ethereum?: EIP1193Provider }).ethereum
    if (!ethereum) throw new Error('MetaMask not available.')

    // Network is CAIP-2, e.g. "eip155:84532"
    const chainId = Number(requirement.network.split(':')[1])
    const chain = CHAINS[chainId]
    if (!chain) throw new Error(`Unsupported network: ${requirement.network}`)

    const walletClient = createWalletClient({
      chain,
      transport: custom(ethereum),
    })

    const [account] = await walletClient.requestAddresses();

    if(!account) return null;

    try {
      await walletClient.switchChain({ id: chain.id })
    } catch (err: any) {
      // 4902 = chain not added to MetaMask
      if (err.code === 4902) {
        await walletClient.addChain({ chain })
        await walletClient.switchChain({ id: chain.id })
      } else {
        throw err
      }
    }

    const validAfter = BigInt(0)
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + requirement.maxTimeoutSeconds)
    const nonce = crypto.getRandomValues(new Uint8Array(32))
    const nonceHex = ('0x' + Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`
    const payTo = getAddress(requirement.payTo)

    const signature = await walletClient.signTypedData({
      account,
      domain: {
        name: requirement.extra.name as string,
        version: requirement.extra.version as string,
        chainId,
        verifyingContract: getAddress(requirement.asset),
      },
      types: {
        TransferWithAuthorization: [
          { name: 'from',        type: 'address' },
          { name: 'to',          type: 'address' },
          { name: 'value',       type: 'uint256' },
          { name: 'validAfter',  type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce',       type: 'bytes32' },
        ],
      },
      primaryType: 'TransferWithAuthorization',
      message: {
        from:        account,
        to:          payTo,
        value:       BigInt(requirement.amount),
        validAfter,
        validBefore,
        nonce:       nonceHex,
      },
    })

    // x402 v2 PaymentPayload: echoes the chosen requirement in `accepted`
    const paymentPayload: PaymentPayload = {
      x402Version: 2,
      resource: paymentRequired.resource,
      accepted: requirement,
      payload: {
        signature,
        authorization: {
          from:        account,
          to:          payTo,
          value:       requirement.amount,
          validAfter:  validAfter.toString(),
          validBefore: validBefore.toString(),
          nonce:       nonceHex,
        },
      },
    }

    return btoa(JSON.stringify(paymentPayload))
  }


  async function readPaymentRequired(response: Response): Promise<PaymentRequired> {
    const header = response.headers.get('PAYMENT-REQUIRED')
    if (header) return JSON.parse(atob(header))
    return await response.json()
  }


  async function pay(url: string, options: RequestInit = {}): Promise<Response> {
    error.value = null
    const response = await fetch(url, options)

    if (response.status !== 402) {
      return response
    }

    isPaying.value = true

    try {
      const paymentRequired = await readPaymentRequired(response)

      if (!paymentRequired.accepts?.length) {
        throw new Error('Server returned 402 but provided no payment requirements.')
      }

      if (!wallet.value.isConnected) {
        console.log('Wallet must be connected before making a payment. Call useWallet().connect() first.')
      }

      // Sign the first accepted payment scheme
      const requirement = paymentRequired.accepts[0]!
      const paymentHeader = await signPayment(paymentRequired, requirement)

      if(!paymentHeader){
        throw new Error("Payment header is null")
      }

      return await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          'PAYMENT-SIGNATURE': paymentHeader,
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
