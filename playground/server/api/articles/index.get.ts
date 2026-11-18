/** Free list of articles with their prices; the content itself is behind /api/articles/:slug. */
export default defineEventHandler(() => {
  return articles.map(({ slug, title, summary, price }) => ({ slug, title, summary, price }))
})
