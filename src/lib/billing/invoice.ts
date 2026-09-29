import type Stripe from 'stripe'

export function subscriptionIdOfInvoice(invoice: Stripe.Invoice): string | null {
  const value = invoice.parent?.subscription_details?.subscription
  return typeof value === 'string' ? value : value?.id ?? null
}

export function paidCreditPeriodEnd(
  invoice: Stripe.Invoice,
  subscriptionId: string,
  lines: Stripe.InvoiceLineItem[]
): number | null {
  // A plan-change proration is a payment, but it is not a new monthly allowance.
  if (invoice.billing_reason !== 'subscription_create' && invoice.billing_reason !== 'subscription_cycle') {
    return null
  }

  const periodEnds = lines
    .filter((line) => line.parent?.type === 'subscription_item_details'
      && line.parent.subscription_item_details?.subscription === subscriptionId
      && line.parent.subscription_item_details.proration === false)
    .map((line) => line.period?.end)
    .filter((end): end is number => typeof end === 'number' && Number.isFinite(end) && end > 0)

  return periodEnds.length ? Math.max(...periodEnds) : null
}
