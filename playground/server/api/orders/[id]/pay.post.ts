import { formatUnits } from 'viem'

/**
 * Shop checkout: the amount is the order total stored on the server.
 *
 * The browser only names the order. A payment signed for any other amount (e.g. edited in devtools) does not match
 * the requirements computed here and gets a new 402 instead of being settled. `key` ties the payment to this order,
 * and computed prices default to accessMaxAge 0, so a paid order never unlocks another one.
 */
export default defineX402Handler({
  price: (event) => {
    const order = orders.get(getRouterParam(event, 'id') ?? '')
    if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found' })
    if (order.status === 'paid') throw createError({ statusCode: 409, statusMessage: 'Order already paid' })

    return {
      amount: formatUnits(BigInt(order.totalAmount), 6),
      key: `order:${order.id}`,
      description: `Order #${order.id}`,
    }
  },
}, (event) => {
  const order = orders.get(getRouterParam(event, 'id')!)!
  const payment = event.context.x402!

  // Fulfil the order: mark it paid with the settlement details
  order.status = 'paid'
  order.txHash = payment.txHash
  order.payer = payment.payer

  return {
    ...order,
    totalFormatted: payment.amountFormatted,
    explorerTxUrl: payment.explorerTxUrl,
  }
})
