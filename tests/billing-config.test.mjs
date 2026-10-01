import assert from 'node:assert/strict'
import test from 'node:test'
import { billingMode } from '../src/lib/billing/config.ts'

const configured = {
  STRIPE_WEBHOOK_SECRET: 'whsec_example',
  STRIPE_PRICE_STARTER: 'price_starter',
  STRIPE_PRICE_PRO: 'price_pro',
}

test('billing stays unavailable unless a complete matching mode is explicitly set', () => {
  assert.equal(billingMode({ ...configured, STRIPE_SECRET_KEY: 'sk_test_example' }), 'disabled')
  assert.equal(billingMode({ ...configured, BILLING_MODE: 'live', STRIPE_SECRET_KEY: 'sk_test_example' }), 'disabled')
  assert.equal(billingMode({ ...configured, BILLING_MODE: 'test', STRIPE_SECRET_KEY: 'sk_live_example' }), 'disabled')
  assert.equal(billingMode({ ...configured, BILLING_MODE: 'live', STRIPE_SECRET_KEY: 'sk_live_example', STRIPE_PRICE_PRO: '' }), 'disabled')
  assert.equal(billingMode({ ...configured, BILLING_MODE: 'test', STRIPE_SECRET_KEY: 'sk_test_example' }), 'test')
  assert.equal(billingMode({ ...configured, BILLING_MODE: 'live', STRIPE_SECRET_KEY: 'sk_live_example' }), 'live')
})
