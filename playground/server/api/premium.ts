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
    // Rendered by pages/premium.vue, so the page content itself is behind the payment wall
    content: {
      title: 'Premium Page',
      paragraphs: [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
        'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
        'Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida.',
      ],
    },
  }
})
