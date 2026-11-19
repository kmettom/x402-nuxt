import { randomUUID } from 'node:crypto'
import { formatUnits } from 'viem'
import type { Order, OrderItem } from '../utils/catalog'

/**
 * Creates an order from product ids and quantities. The browser never sends prices:
 * the total is computed here from the catalog, and the pay route charges exactly that.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ items?: { productId: string, quantity: number }[] }>(event)

  const items: OrderItem[] = []
  for (const { productId, quantity } of body?.items ?? []) {
    const product = products.find(p => p.id === productId)
    if (!product) throw createError({ statusCode: 400, statusMessage: `Unknown product "${productId}"` })
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw createError({ statusCode: 400, statusMessage: 'Quantity must be a whole number from 1 to 99' })
    }
    items.push({ productId, name: product.name, quantity, unitAmount: parseUsdPrice(product.price).toString() })
  }
  if (!items.length) throw createError({ statusCode: 400, statusMessage: 'The cart is empty' })

  const total = items.reduce((sum, item) => sum + BigInt(item.unitAmount) * BigInt(item.quantity), BigInt(0))
  const order: Order = { id: randomUUID().slice(0, 8), items, totalAmount: total.toString(), status: 'pending' }
  await saveOrder(order)

  return { ...order, totalFormatted: `${formatUnits(total, 6)} USDC` }
})
