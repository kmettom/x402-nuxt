import { defineEventHandler } from 'h3'
import type { EventHandler, EventHandlerRequest, H3Event } from 'h3'
import type { PaymentRequired, X402HandlerOptions } from '../../types'
import { handleX402Payment } from './x402Payment'

/**
 * Defines a paid route. The handler only runs after the payment is verified and settled
 * (or a valid access cookie is present); the payment is on `event.context.x402`.
 *
 * The price is decided on the server: a fixed price, bounds for a payer-chosen amount,
 * or a function that computes it from the request (e.g. an order total from the database).
 *
 * @example
 * export default defineX402Handler({
 *   price: async (event) => {
 *     const order = await getOrder(getRouterParam(event, 'id'))
 *     return { amount: order.total, key: `order:${order.id}` }
 *   },
 * }, async (event) => {
 *   await markOrderPaid(event.context.x402!)
 *   return { ok: true }
 * })
 */
export function defineX402Handler<T, Request extends EventHandlerRequest = EventHandlerRequest>(
  options: X402HandlerOptions,
  handler: EventHandler<Request, T>,
): EventHandler<Request, Promise<T | PaymentRequired>> {
  return defineEventHandler<Request>(async (event: H3Event<Request>) => {
    const challenge = await handleX402Payment(event, options)
    if (challenge) return challenge
    return await handler(event)
  })
}
