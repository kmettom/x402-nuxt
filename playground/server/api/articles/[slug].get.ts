/**
 * Price per item: each article has its own price, looked up on the server.
 * `key` scopes the access cookie to this article, so paying for one article never unlocks another.
 */
export default defineX402Handler({
  price: (event) => {
    const article = articles.find(a => a.slug === getRouterParam(event, 'slug'))
    if (!article) throw createError({ statusCode: 404, statusMessage: 'Article not found' })
    return { amount: article.price, key: `article:${article.slug}`, description: article.title }
  },
  // Keep each paid article unlocked for 24 h (computed prices default to pay-per-request)
  accessMaxAge: 60 * 60 * 24,
}, (event) => {
  const article = articles.find(a => a.slug === getRouterParam(event, 'slug'))!
  const payment = event.context.x402!

  return {
    title: article.title,
    paragraphs: article.paragraphs,
    amountFormatted: payment.amountFormatted,
    txHash: payment.txHash,
    explorerTxUrl: payment.explorerTxUrl,
    accessExpiresAt: payment.accessExpiresAt,
  }
})
