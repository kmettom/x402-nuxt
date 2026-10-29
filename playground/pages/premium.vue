<script setup lang="ts">
definePageMeta({
  // Only reachable after a successful payment; content comes from the paid /api/premium response
  middleware: () => {
    if (!useState('premium:access').value) return navigateTo('/protected')
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
      <p style="margin: 0 0 0.5rem;">Payer: <code>{{ access.payer }}</code></p>
      <p v-if="access.txHash" style="margin: 0;">
        Transaction:
        <a :href="`https://sepolia.basescan.org/tx/${access.txHash}`" target="_blank" rel="noopener">
          <code>{{ access.txHash }}</code>
        </a>
      </p>
    </section>
  </div>
</template>
