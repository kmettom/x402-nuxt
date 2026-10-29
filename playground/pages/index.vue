<script setup lang="ts">
const { wallet, connect, disconnect } = useWallet()
const { isPaying, error, unlock } = usePremiumAccess()

const premiumContent = ref<string | null>(null)

async function handleFetchPremium() {
  premiumContent.value = null
  // Redirects to /premium on success
  premiumContent.value = await unlock()
}
</script>

<template>
  <div style="max-width: 640px; margin: 2rem auto; font-family: system-ui, sans-serif;">
    <h1>x402-nuxt Playground</h1>
    <p>Test the x402 payment protocol integration.</p>

    <section style="margin: 2rem 0; padding: 1rem; border: 1px solid #ddd; border-radius: 8px;">
      <h2>Wallet</h2>
      <div v-if="wallet.isConnected">
        <p>Connected: <code>{{ wallet.address }}</code></p>
        <button @click="disconnect">
          Disconnect
        </button>
      </div>
      <div v-else>
        <button :disabled="wallet.isLoading" @click="connect">
          {{ wallet.isLoading ? 'Connecting...' : 'Connect MetaMask' }}
        </button>
      </div>
      <p v-if="wallet.error" style="color: red;">
        {{ wallet.error }}
      </p>
    </section>

    <section style="margin: 2rem 0; padding: 1rem; border: 1px solid #ddd; border-radius: 8px;">
      <h2>Premium Content (402 Protected)</h2>
      <button :disabled="isPaying" @click="handleFetchPremium">
        {{ isPaying ? 'Processing payment...' : 'Unlock premium page' }}
      </button>
      <p v-if="error" style="color: red;">
        {{ error }}
      </p>
      <pre
        v-if="premiumContent"
        style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto;"
      >{{ premiumContent }}</pre>
    </section>

    <section style="margin: 2rem 0; padding: 1rem; border: 1px solid #ddd; border-radius: 8px;">
      <h2>Free Endpoint</h2>
      <p>The <code>/api/hello</code> endpoint is not protected and returns data freely.</p>
    </section>
  </div>
</template>