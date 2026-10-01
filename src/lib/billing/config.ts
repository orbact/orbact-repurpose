export type BillingMode = 'disabled' | 'test' | 'live'

export function billingMode(env: NodeJS.ProcessEnv = process.env): BillingMode {
  const mode = env.BILLING_MODE
  if (mode !== 'test' && mode !== 'live') return 'disabled'

  const keyPrefix = mode === 'live' ? 'sk_live_' : 'sk_test_'
  if (!env.STRIPE_SECRET_KEY?.startsWith(keyPrefix) ||
      !env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_') ||
      !env.STRIPE_PRICE_STARTER?.startsWith('price_') ||
      !env.STRIPE_PRICE_PRO?.startsWith('price_')) return 'disabled'

  return mode
}
