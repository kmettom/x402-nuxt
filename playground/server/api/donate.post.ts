/**
 * Donation with a payer-chosen amount.
 * The price bounds live in nuxt.config (`'POST /api/donate': { price: { min, max } }`); the middleware checks the
 * amount from the X402-Amount header against them, so this handler only runs after the donation is settled.
 */
export default defineEventHandler((event) => {
  const payment = event.context.x402!

  return {
    message: 'Thank you for your donation!',
    amountFormatted: payment.amountFormatted,
    payer: payment.payer,
    txHash: payment.txHash,
    explorerTxUrl: payment.explorerTxUrl,
  }
})
