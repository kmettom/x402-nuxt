<script setup lang="ts">
import type { X402Quote } from '../../../src/runtime/types'

interface PaidArticle {
  title: string
  paragraphs: string[]
  amountFormatted: string
  txHash?: string
  explorerTxUrl?: string
  accessExpiresAt?: number
}

const route = useRoute()
const url = computed(() => `/api/articles/${route.params.slug}`)

const { wallet, connect } = useWallet()
const { pay, quote, isPaying } = useX402Payment()

// Already paid: the access cookie for this article unlocks it again (useRequestFetch forwards it during SSR)
const requestFetch = useRequestFetch()
const article = ref<PaidArticle | null>(await requestFetch<PaidArticle>(url.value).catch(() => null))
const price = ref<X402Quote | null>(null)
const message = ref<string | null>(null)

onMounted(async () => {
  if (!article.value) price.value = await quote(url.value).catch(() => null)
})

async function unlock() {
  message.value = null
  try {
    const response = await pay(url.value)
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      message.value = body?.message ?? `Error ${response.status}`
      return
    }
    article.value = body
  }
  catch (err) {
    message.value = err instanceof Error ? err.message : 'Payment failed'
  }
}
</script>

<template>
  <div style="max-width: 640px; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, sans-serif;">
    <NuxtLink to="/articles">← All articles</NuxtLink>

    <article v-if="article">
      <h1>{{ article.title }}</h1>
      <p v-for="(paragraph, i) in article.paragraphs" :key="i" style="line-height: 1.6;">{{ paragraph }}</p>
      <p style="font-size: 0.875rem; color: #555;">
        Paid {{ article.amountFormatted }}.
        <template v-if="article.accessExpiresAt">Unlocked until {{ new Date(article.accessExpiresAt * 1000).toLocaleString() }}.</template>
        <a v-if="article.txHash" :href="article.explorerTxUrl" target="_blank" rel="noopener">View transaction</a>
      </p>
    </article>

    <section v-else style="margin: 2rem 0; padding: 2rem 1rem; border: 1px solid #ddd; border-radius: 8px; text-align: center;">
      <strong style="font-size: 1.125rem;">🔒 {{ price?.description ?? 'Article locked' }}</strong>
      <p v-if="price" style="color: #555;">
        Price: <strong>{{ price.amountFormatted }}</strong> on <strong>{{ price.networkName }}</strong>
      </p>
      <button v-if="!wallet.isConnected" :disabled="wallet.isLoading" @click="connect">Connect MetaMask</button>
      <button v-else :disabled="isPaying" @click="unlock">
        {{ isPaying ? 'Processing payment...' : price ? `Pay ${price.amountFormatted} to read` : 'Pay to read' }}
      </button>
      <p v-if="message" style="color: red; word-break: break-word;">{{ message }}</p>
    </section>
  </div>
</template>
