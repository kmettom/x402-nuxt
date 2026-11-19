<script setup lang="ts">
interface DonationReceipt {
  message: string
  amountFormatted: string
  payer?: string
  txHash?: string
  explorerTxUrl?: string
}

const { wallet, connect } = useWallet()
const { pay, isPaying } = useX402Payment()

// Free input: the server accepts any amount between the min and max set in nuxt.config
const amount = ref('5.0')
const receipt = ref<DonationReceipt | null>(null)
const message = ref<string | null>(null)

async function donate() {
  message.value = null
  receipt.value = null
  try {
    // `amount` is sent as the X402-Amount header; the 402 challenge then asks for exactly that amount
    const response = await pay('/api/donate', { method: 'POST', amount: amount.value })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      message.value = body?.message ?? `Error ${response.status}`
      return
    }
    receipt.value = body
  }
  catch (err) {
    message.value = err instanceof Error ? err.message : 'Payment failed'
  }
}
</script>

<template>
  <div style="max-width: 640px; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, sans-serif;">
    <h1>Support this project</h1>
    <p>
      Pick any amount between <strong>0.001</strong> and <strong>10 USDC</strong>.
      The amount comes from the input below, and the server only checks it against the bounds in <code>nuxt.config</code>.
    </p>

    <form style="display: flex; gap: 0.5rem; align-items: center; margin: 1.5rem 0;" @submit.prevent="donate">
      <label>
        Amount (USDC)
        <input v-model="amount" type="number" min="0.001" max="10" step="0.001" required style="width: 8rem; margin-left: 0.5rem;">
      </label>
      <button v-if="!wallet.isConnected" type="button" :disabled="wallet.isLoading" @click="connect">
        Connect MetaMask
      </button>
      <button v-else type="submit" :disabled="isPaying">
        {{ isPaying ? 'Processing payment...' : `Donate ${amount} USDC` }}
      </button>
    </form>

    <p v-if="message" style="color: red; word-break: break-word;">{{ message }}</p>

    <section v-if="receipt" style="padding: 1rem; background: #e6f4ea; border-radius: 8px; word-break: break-all;">
      <p style="margin: 0 0 0.5rem;"><strong>{{ receipt.message }}</strong></p>
      <p style="margin: 0 0 0.5rem;">Donated: {{ receipt.amountFormatted }}</p>
      <p style="margin: 0 0 0.5rem;">From: <code>{{ receipt.payer }}</code></p>
      <p v-if="receipt.txHash" style="margin: 0;">
        Transaction: <a :href="receipt.explorerTxUrl" target="_blank" rel="noopener"><code>{{ receipt.txHash }}</code></a>
      </p>
    </section>
  </div>
</template>
