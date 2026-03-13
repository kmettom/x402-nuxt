import {ref} from 'vue'
import {useState} from '#imports'
import type {EIP1193Provider, PaymentChallengeResponse, PaymentRequirement, WalletState} from '../types'
import { createWalletClient, custom, parseUnits } from 'viem'
import { baseSepolia } from 'viem/chains'

export function useX402Payment() {
  const isPaying = ref(false)
  const error = ref<string | null>(null)

  const wallet = useState<WalletState>('x402:wallet', () => ({
    address: '',
    isConnected: false,
    isLoading: false,
    error: null,
  }))


  async function signPayment(requirement: PaymentRequirement | null): Promise<string|null> {
    console.log("signPayment")
    if (!requirement) throw new Error('requirement missing.')
    if (!import.meta.client) throw new Error('signPayment can only be called on the client.')

    const ethereum = (window as unknown as { ethereum?: EIP1193Provider }).ethereum
    if (!ethereum) throw new Error('MetaMask not available.')

    const walletClient = createWalletClient({
      chain: baseSepolia,
      transport: custom(ethereum),
    })

    const [account] = await walletClient.requestAddresses();

    console.log("account", account)

    if(!account) return null;

    try {
      await walletClient.switchChain({ id: baseSepolia.id })
    } catch (err: any) {
      // 4902 = chain not added to MetaMask
      if (err.code === 4902) {
        await walletClient.addChain({ chain: baseSepolia })
        await walletClient.switchChain({ id: baseSepolia.id })
      } else {
        throw err
      }
    }

    const validAfter = BigInt(0)
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 300) // 5 min window
    const nonce = crypto.getRandomValues(new Uint8Array(32))
    const nonceHex = ('0x' + Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`

    console.log("validAfter", validAfter)
    console.log("validBefore", validBefore)
    console.log("nonce", nonce)
    console.log("nonceHex", nonceHex)
    // USDC contract on Base Sepolia
    const usdcAddress = (requirement.asset ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as `0x${string}`
    console.log("usdcAddress", usdcAddress)
    console.log("requirement.max", requirement.maxAmountRequired)

    const signature = await walletClient.signTypedData({
      account,
      domain: {
        name: 'USDC',
        version: '2',
        chainId: 84532,
        verifyingContract: usdcAddress,
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
        to:          requirement.payTo as `0x${string}`,
        value:       BigInt(requirement.maxAmountRequired),
        validAfter,
        validBefore,
        nonce:       nonceHex,
      },
    })

    console.log("signature", signature)

    // Build the payload the facilitator expects
    const paymentData = {
      x402Version: 2,
      scheme: 'exact',
      network: requirement.network,
      payload: {
        signature,
        authorization: {
          from:        account,
          to:          requirement.payTo,
          value:       requirement.maxAmountRequired,
          validAfter:  validAfter.toString(),
          validBefore: validBefore.toString(),
          nonce:       nonceHex,
        },
      },
    }

    console.log("paymentData", paymentData)

    return btoa(JSON.stringify(paymentData))
  }


  async function pay(url: string, options: RequestInit = {}): Promise<Response> {
    console.log("pay url", url)
    console.log("pay options",options)
    error.value = null
    const response = await fetch(url, options)

    console.log("pay response", response)

    if (response.status !== 402) {
      return response
    }

    isPaying.value = true

    try {
      const challenge: PaymentChallengeResponse = await response.json()
      console.log("challenge", challenge)

      if (!challenge.accepts?.length) {
        console.log('Server returned 402 but provided no payment requirements.')
      }

      if (!wallet.value.isConnected) {
        console.log('Wallet must be connected before making a payment. Call useWallet().connect() first.')
      }

      // Sign the first accepted payment scheme
      const requirement = challenge.accepts[0]
      console.log("requirement", requirement)
      const paymentHeader = await signPayment(requirement ?? null)

      console.log("paymentHeader", paymentHeader)

      if(!paymentHeader){
        throw new Error("Payment header is null")
      }

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