<script setup lang="ts">
const { wallet, connect, disconnect } = useWallet()
const { isPaying, error, pay } = useX402Payment()

const premiumContent = ref<string | null>(null)

async function handleFetchPremium() {
  premiumContent.value = null
  console.log("handleFetchPremium Index" )
  try {
    const response = await pay('/api/premium')
    if (response.ok) {
      const data = await response.json()
      premiumContent.value = JSON.stringify(data, null, 2)
    }
    else {
      premiumContent.value = `Error: ${response.status} ${response.statusText}`
    }
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    premiumContent.value = `Payment error: ${message}`
  }
}
</script>

<template>
  <div style="max-width: 640px; margin: 2rem auto; font-family: system-ui, sans-serif;">
    <h1>nuxt-x402 Playground</h1>
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
        {{ isPaying ? 'Processing payment...' : 'Fetch /api/premium' }}
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