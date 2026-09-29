import assert from 'node:assert/strict'
import test from 'node:test'
import { paidCreditPeriodEnd, subscriptionIdOfInvoice } from '../src/lib/billing/invoice.ts'

const subscriptionId = 'sub_test'
const periodEnd = 1_795_937_043
const invoice = {
  billing_reason: 'subscription_cycle',
  parent: { subscription_details: { subscription: subscriptionId } },
}
const line = {
  parent: {
    type: 'subscription_item_details',
    subscription_item_details: { subscription: subscriptionId, proration: false },
  },
  period: { end: periodEnd },
}

test('paid renewal uses the subscription line period even when other lines are present', () => {
  assert.equal(subscriptionIdOfInvoice(invoice), subscriptionId)
  assert.equal(paidCreditPeriodEnd(invoice, subscriptionId, [
    { ...line, parent: { ...line.parent, subscription_item_details: { ...line.parent.subscription_item_details, proration: true } } },
    { ...line, parent: { ...line.parent, subscription_item_details: { ...line.parent.subscription_item_details, subscription: 'sub_other' } } },
    line,
  ]), periodEnd)
})

test('plan-change prorations and one-off invoices do not renew credits', () => {
  assert.equal(paidCreditPeriodEnd({ ...invoice, billing_reason: 'subscription_update' }, subscriptionId, [line]), null)
  assert.equal(paidCreditPeriodEnd({ ...invoice, billing_reason: 'manual' }, subscriptionId, [line]), null)
  assert.equal(paidCreditPeriodEnd(invoice, subscriptionId, [{ ...line, parent: { ...line.parent, subscription_item_details: { ...line.parent.subscription_item_details, proration: true } } }]), null)
})

test('missing or expanded subscription reference is handled', () => {
  assert.equal(subscriptionIdOfInvoice({ parent: null }), null)
  assert.equal(subscriptionIdOfInvoice({ parent: { subscription_details: { subscription: { id: subscriptionId } } } }), subscriptionId)
  assert.equal(paidCreditPeriodEnd(invoice, subscriptionId, [
    line,
    { ...line, period: { end: periodEnd + 100 } },
  ]), periodEnd + 100)
})
