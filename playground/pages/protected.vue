<script setup lang="ts">
const { wallet, connect } = useWallet()
const { isPaying, error, unlock } = usePremiumAccess()

const result = ref<string | null>(null)

async function fetchProtectedData() {
  result.value = null
  // Redirects to /premium on success
  result.value = await unlock()
}
</script>

<template>
  <div style="max-width: 640px; margin: 2rem auto; font-family: system-ui, sans-serif;">
    <h1>Protected Route Demo</h1>
    <p>
      This page demonstrates accessing a 402-protected API endpoint.
      You must connect your wallet and sign a payment to access the data.
    </p>

    <div v-if="!wallet.isConnected" style="margin: 2rem 0;">
      <p>Connect your wallet to get started:</p>
      <button @click="connect">
        Connect MetaMask
      </button>
    </div>

    <div v-else style="margin: 2rem 0;">
      <p>Wallet: <code>{{ wallet.address }}</code></p>
      <button :disabled="isPaying" @click="fetchProtectedData">
        {{ isPaying ? 'Signing payment...' : 'Pay to open premium page' }}
      </button>
    </div>

    <p v-if="error" style="color: red;">
      {{ error }}
    </p>

    <pre
      v-if="result"
      style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; margin-top: 1rem;"
    >{{ result }}</pre>
  </div>
</template>