import Stripe from 'stripe'

let client: Stripe | undefined

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured')
  return client ??= new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-08-26.dahlia',
  })
}

export const PLAN_PRICES = {
  starter: {
    priceId: process.env.STRIPE_PRICE_STARTER!,
    limit: 30,
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_PRO!,
    limit: 150,
  },
} as const
