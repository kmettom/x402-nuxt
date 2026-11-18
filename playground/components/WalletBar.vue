<script setup lang="ts">
const { wallet, connect, disconnect } = useWallet()
</script>

<template>
  <span style="display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.875rem;">
    <template v-if="wallet.isConnected">
      <code>{{ wallet.address.slice(0, 6) }}…{{ wallet.address.slice(-4) }}</code>
      <button @click="disconnect">Disconnect</button>
    </template>
    <button v-else :disabled="wallet.isLoading" @click="connect">
      {{ wallet.isLoading ? 'Connecting...' : 'Connect MetaMask' }}
    </button>
    <span v-if="wallet.error" style="color: red;">{{ wallet.error }}</span>
  </span>
</template>
