// playground/server/api/premium.ts
import { defineEventHandler } from 'h3'

export default defineEventHandler((event) => {
  // event.context.x402 is set by the middleware after payment verification
  const payment = event.context.x402

  return {
    message: 'You have accessed the premium content!',
    payer: payment?.payer,
    txHash: payment?.txHash,
    timestamp: new Date().toISOString(),
  }
})
