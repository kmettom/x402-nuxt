/**
 * In-memory data for the playground examples. In a real app this is your database or CMS.
 * Prices are stored on the server only; the browser never sends them back.
 */

export interface Article {
  slug: string
  title: string
  summary: string
  /** USD price paid in USDC. */
  price: string
  paragraphs: string[]
}

export const articles: Article[] = [
  {
    slug: 'getting-started',
    title: 'Getting started with x402',
    summary: 'A short introduction to paying for HTTP requests.',
    price: '$0.001',
    paragraphs: [
      'x402 uses the HTTP 402 status code to ask for a payment before serving a resource.',
      'The client signs a USDC transfer authorization, and a facilitator settles it on chain.',
    ],
  },
  {
    slug: 'agent-payments',
    title: 'Payments for AI agents',
    summary: 'Why machine-to-machine payments need a protocol like x402.',
    price: '$0.002',
    paragraphs: [
      'Agents can read a 402 challenge, decide whether the price is acceptable and pay without a checkout page.',
      'Because the price is in the challenge, an agent can compare offers before spending anything.',
    ],
  },
  {
    slug: 'deep-dive',
    title: 'Deep dive: settlement and access cookies',
    summary: 'How a single payment unlocks content for a while.',
    price: '$0.005',
    paragraphs: [
      'After the facilitator settles the payment, the server sets a signed httpOnly cookie scoped to the route and item.',
      'Reloading the page sends the cookie, so the reader is not charged again until it expires.',
    ],
  },
]

export interface Product {
  id: string
  name: string
  /** USD price paid in USDC. */
  price: string
}

export const products: Product[] = [
  { id: 'sticker', name: 'x402 sticker', price: '$0.001' },
  { id: 'mug', name: 'x402 mug', price: '$0.005' },
  { id: 'shirt', name: 'x402 T-shirt', price: '$0.01' },
]

export interface OrderItem {
  productId: string
  name: string
  quantity: number
  /** Atomic USDC units for one item. */
  unitAmount: string
}

export interface Order {
  id: string
  items: OrderItem[]
  /** Order total in atomic USDC units, computed on the server. */
  totalAmount: string
  status: 'pending' | 'paid'
  txHash?: string
  payer?: string
}

export const orders = new Map<string, Order>()
