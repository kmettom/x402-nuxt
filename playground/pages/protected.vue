<script setup lang="ts">
definePageMeta({
  // Already paid: skip the paywall and show the premium page
  middleware: () => {
    if (useState('premium:access').value) return navigateTo('/premium')
  },
})

const { wallet, connect } = useWallet()
const { isPaying, error, unlock } = usePremiumAccess()

const result = ref<string | null>(null)

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
        <span style="font-size: 0.875rem; color: #555;">Pay with USDC on Base Sepolia to unlock.</span>

        <button v-if="!wallet.isConnected" :disabled="wallet.isLoading" @click="connect">
          {{ wallet.isLoading ? 'Connecting...' : 'Connect MetaMask' }}
        </button>
        <button v-else :disabled="isPaying" @click="handleUnlock">
          {{ isPaying ? 'Processing payment...' : 'Pay to unlock' }}
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
