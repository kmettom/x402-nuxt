<script setup lang="ts">
definePageMeta({
  // Already paid: skip the paywall and show the premium page
  middleware: () => {
    if (useState('premium:access').value) return navigateTo('/premium')
  },
})

const { wallet, connect } = useWallet()
const { price, isPaying, error, loadPrice, unlock } = usePremiumAccess()

const result = ref<string | null>(null)

onMounted(loadPrice)

async function handleUnlock() {
  result.value = null
  // Redirects to /premium on success
  result.value = await unlock()
}
</script>

<template>
  <div style="max-width: 640px; margin: 2rem auto; font-family: system-ui, sans-serif;">
    <h1>Premium Content</h1>
    <p>This content is locked behind an x402 payment wall.</p>

    <section style="position: relative; margin: 2rem 0; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
      <!-- Placeholder lines; the real content is only sent by the server after payment -->
      <div aria-hidden="true" style="padding: 3rem 1.5rem; filter: blur(4px); user-select: none;">
        <div v-for="width in ['90%', '100%', '75%', '95%', '60%']" :key="width" :style="{ width, height: '0.75rem', margin: '0 0 1rem', background: '#ccc', borderRadius: '4px' }" />
      </div>

      <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; padding: 1rem; background: rgba(255, 255, 255, 0.7); text-align: center;">
        <strong style="font-size: 1.125rem;">🔒 Content locked</strong>
        <span v-if="price" style="font-size: 0.875rem; color: #555;">
          Price: <strong>{{ price.amountFormatted }}</strong> on <strong>{{ price.networkName }}</strong>
        </span>
        <span v-else style="font-size: 0.875rem; color: #555;">Pay with USDC to unlock.</span>
        <span v-if="price" style="font-size: 0.75rem; color: #777; max-width: 26rem;">
          MetaMask shows the value in USDC base units ({{ price.amount }} = {{ price.amountFormatted }}). No ETH is spent; the facilitator pays the gas.
        </span>

        <button v-if="!wallet.isConnected" :disabled="wallet.isLoading" @click="connect">
          {{ wallet.isLoading ? 'Connecting...' : 'Connect MetaMask' }}
        </button>
        <button v-else :disabled="isPaying" @click="handleUnlock">
          {{ isPaying ? 'Processing payment...' : price ? `Pay ${price.amountFormatted} to unlock` : 'Pay to unlock' }}
        </button>
      </div>
    </section>

    <p v-if="wallet.isConnected" style="font-size: 0.875rem;">
      Wallet: <code>{{ wallet.address }}</code>
    </p>
    <p v-if="wallet.error || error || result" style="color: red; word-break: break-word;">
      {{ result ?? error ?? wallet.error }}
    </p>
  </div>
</template>
