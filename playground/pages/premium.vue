<script setup lang="ts">
definePageMeta({
  // Only reachable after a successful payment; content comes from the paid /api/premium response.
  // On a reload the access cookie from that payment unlocks /api/premium again.
  middleware: async () => {
    if (!await usePremiumAccess().restore()) return navigateTo('/protected')
  },
})

const { access } = usePremiumAccess()
</script>

<template>
  <div v-if="access" style="max-width: 640px; margin: 2rem auto; font-family: system-ui, sans-serif;">
    <p style="display: inline-block; padding: 0.25rem 0.75rem; background: #e6f4ea; color: #1e7e34; border-radius: 999px; font-size: 0.875rem;">
      Payment confirmed
    </p>
    <h1>{{ access.content.title }}</h1>
    <p><strong>This is the premium page behind the x402 payment wall.</strong></p>

    <p v-for="(paragraph, i) in access.content.paragraphs" :key="i" style="line-height: 1.6;">
      {{ paragraph }}
    </p>

    <section style="margin-top: 2rem; padding: 1rem; background: #f5f5f5; border-radius: 4px; font-size: 0.875rem; word-break: break-all;">
      <p v-if="access.amountFormatted" style="margin: 0 0 0.5rem;">
        Paid: <strong>{{ access.amountFormatted }}</strong> on <strong>{{ access.networkName }}</strong>
      </p>
      <p style="margin: 0 0 0.5rem;">Payer: <code>{{ access.payer }}</code></p>
      <p v-if="access.accessExpiresAt" style="margin: 0 0 0.5rem;">
        Access valid until: {{ new Date(access.accessExpiresAt * 1000).toLocaleString() }}
      </p>
      <p v-if="access.txHash" style="margin: 0;">
        Transaction:
        <a :href="access.explorerTxUrl" target="_blank" rel="noopener">
          <code>{{ access.txHash }}</code>
        </a>
      </p>
    </section>
  </div>
</template>
