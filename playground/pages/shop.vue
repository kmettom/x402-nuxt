<script setup lang="ts">
import type { X402Quote } from '../../src/runtime/types'

interface OrderView {
  id: string
  items: { productId: string, name: string, quantity: number }[]
  totalFormatted: string
  status: 'pending' | 'paid'
  txHash?: string
  payer?: string
  explorerTxUrl?: string
}

const { data: products } = await useFetch('/api/products')
const { wallet, connect } = useWallet()
const { pay, quote, isPaying } = useX402Payment()

const quantities = reactive<Record<string, number>>({})
const order = ref<OrderView | null>(null)
const price = ref<X402Quote | null>(null)
const message = ref<string | null>(null)

const cartItems = computed(() =>
  Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([productId, quantity]) => ({ productId, quantity })),
)

/** Step 1: create the order. Only product ids and quantities are sent; the server computes the total. */
async function checkout() {
  message.value = null
  price.value = null
  try {
    order.value = await $fetch<OrderView>('/api/orders', { method: 'POST', body: { items: cartItems.value } })
    // Read the amount the server will charge from the 402 challenge
    price.value = await quote(`/api/orders/${order.value.id}/pay`, { method: 'POST' })
  }
  catch (err: any) {
    message.value = err?.data?.statusMessage ?? err?.message ?? 'Checkout failed'
  }
}

/** Step 2: pay the order. The server charges the stored total, whatever the page shows. */
async function payOrder() {
  if (!order.value) return
  message.value = null
  try {
    const response = await pay(`/api/orders/${order.value.id}/pay`, { method: 'POST' })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      message.value = body?.message ?? body?.statusMessage ?? `Error ${response.status}`
      return
    }
    order.value = body
    for (const key of Object.keys(quantities)) quantities[key] = 0
  }
  catch (err) {
    message.value = err instanceof Error ? err.message : 'Payment failed'
  }
}
</script>

<template>
  <div style="max-width: 640px; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, sans-serif;">
    <h1>Shop</h1>
    <p>
      The browser sends only product ids and quantities. The server computes the order total and charges exactly that,
      so changing prices in the page or in devtools has no effect on the payment.
    </p>

    <table style="width: 100%; border-collapse: collapse; margin: 1.5rem 0;">
      <tr v-for="product in products" :key="product.id" style="border-bottom: 1px solid #eee;">
        <td style="padding: 0.5rem 0;">{{ product.name }}</td>
        <td style="color: #555;">{{ product.price.replace('$', '') }} USDC</td>
        <td style="text-align: right;">
          <input v-model.number="quantities[product.id]" type="number" min="0" max="99" placeholder="0" style="width: 4rem;">
        </td>
      </tr>
    </table>

    <button :disabled="!cartItems.length || order?.status === 'pending'" @click="checkout">Create order</button>

    <section v-if="order" style="margin: 1.5rem 0; padding: 1rem; border: 1px solid #ddd; border-radius: 8px; word-break: break-all;">
      <h2 style="margin: 0 0 0.5rem; font-size: 1.125rem;">Order #{{ order.id }}</h2>
      <ul style="margin: 0 0 0.5rem; padding-left: 1.25rem;">
        <li v-for="item in order.items" :key="item.productId">{{ item.quantity }} × {{ item.name }}</li>
      </ul>
      <p style="margin: 0 0 0.5rem;">Total: <strong>{{ order.totalFormatted }}</strong></p>

      <template v-if="order.status === 'pending'">
        <p v-if="price" style="margin: 0 0 0.5rem; font-size: 0.875rem; color: #555;">
          Server asks for {{ price.amountFormatted }} on {{ price.networkName }}.
        </p>
        <button v-if="!wallet.isConnected" :disabled="wallet.isLoading" @click="connect">Connect MetaMask</button>
        <button v-else :disabled="isPaying" @click="payOrder">
          {{ isPaying ? 'Processing payment...' : `Pay ${order.totalFormatted}` }}
        </button>
        <button style="margin-left: 0.5rem;" @click="order = null">Cancel</button>
      </template>

      <template v-else>
        <p style="margin: 0 0 0.5rem; color: #1e7e34;"><strong>Paid</strong> by <code>{{ order.payer }}</code></p>
        <p v-if="order.txHash" style="margin: 0;">
          Transaction: <a :href="order.explorerTxUrl" target="_blank" rel="noopener"><code>{{ order.txHash }}</code></a>
        </p>
      </template>
    </section>

    <p v-if="message" style="color: red; word-break: break-word;">{{ message }}</p>
  </div>
</template>
