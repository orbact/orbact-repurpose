import { NextRequest, NextResponse } from 'next/server'
import { getStripe, PLAN_PRICES } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { paidCreditPeriodEnd, subscriptionIdOfInvoice } from '@/lib/billing/invoice'
import Stripe from 'stripe'

function planForPrice(priceId: string | undefined): 'starter' | 'pro' | null {
  if (priceId === PLAN_PRICES.starter.priceId) return 'starter'
  if (priceId === PLAN_PRICES.pro.priceId) return 'pro'
  return null
}

function customerIdOf(value: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  return typeof value === 'string' ? value : value?.id ?? null
}

async function syncSubscription(subscriptionId: string, expectedCustomerId?: string) {
  const stripe = getStripe()
  // Fetch current Stripe state so delayed and repeated events cannot restore an older plan.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const customerId = customerIdOf(subscription.customer)
  if (!customerId || (expectedCustomerId && expectedCustomerId !== customerId)) {
    throw new Error('Subscription customer mismatch')
  }
  const admin = createAdminClient()
  const active = subscription.status === 'active' || subscription.status === 'trialing'
  const ended = subscription.status === 'canceled' || subscription.status === 'incomplete_expired'
  const plan = planForPrice(subscription.items.data[0]?.price.id)
  if (active && !plan) throw new Error('Subscription has an unknown Stripe price')

  const { data: current, error: readError } = await admin
    .from('profiles')
    .select('id, stripe_subscription_id')
    .eq('stripe_customer_id', customerId)
    .single()
  if (readError || !current) throw readError ?? new Error('Billing profile not found')

  // A stale event from a retired subscription must not replace a newer one.
  if (!active && current.stripe_subscription_id && current.stripe_subscription_id !== subscription.id) return

  const periodEnd = subscription.items.data[0]?.current_period_end
  const endsAt = subscription.cancel_at
    ? new Date(subscription.cancel_at * 1000).toISOString()
    : subscription.cancel_at_period_end && periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null

  const { error: updateError } = await admin
    .from('profiles')
    .update({
      plan: active ? plan : 'free',
      generations_limit: active && plan ? PLAN_PRICES[plan].limit : 3,
      // Keep a recoverable past-due subscription linked so checkout cannot create
      // a second subscription and the customer can return to the billing portal.
      stripe_subscription_id: ended ? null : subscription.id,
      subscription_status: subscription.status,
      subscription_ends_at: endsAt,
    })
    .eq('id', current.id)
  if (updateError) throw updateError
}

async function applyInvoice(invoiceId: string) {
  const stripe = getStripe()
  // A snapshot event can use an older API version and only embeds the first
  // page of lines. Read the invoice and all of its lines from Stripe instead.
  const invoice = await stripe.invoices.retrieve(invoiceId)
  const subscriptionId = subscriptionIdOfInvoice(invoice)
  const customerId = customerIdOf(invoice.customer)
  if (!subscriptionId || !customerId) {
    if (invoice.billing_reason?.startsWith('subscription_')) {
      throw new Error('Subscription invoice lacks a customer or subscription')
    }
    return
  }

  await syncSubscription(subscriptionId, customerId)
  if (invoice.status !== 'paid') throw new Error('Paid invoice event does not reference a paid invoice')

  if (invoice.billing_reason !== 'subscription_create' && invoice.billing_reason !== 'subscription_cycle') return

  const lines: Stripe.InvoiceLineItem[] = []
  for await (const line of stripe.invoices.listLineItems(invoice.id, { limit: 100 })) lines.push(line)
  const periodEnd = paidCreditPeriodEnd(invoice, subscriptionId, lines)
  if (!periodEnd) throw new Error('Paid subscription invoice lacks a credit period')

  const admin = createAdminClient()
  const { data: applied, error } = await admin.rpc('apply_paid_invoice', {
    p_invoice_id: invoice.id,
    p_customer_id: customerId,
    p_subscription_id: subscriptionId,
    p_period_end: new Date(periodEnd * 1000).toISOString(),
  })
  if (error) throw error
  if (!applied) {
    const { data: recorded, error: ledgerError } = await admin
      .from('stripe_paid_invoices').select('invoice_id').eq('invoice_id', invoice.id).maybeSingle()
    if (ledgerError || !recorded) throw ledgerError ?? new Error('Paid invoice was not recorded')
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 })
  }
  const stripe = getStripe()
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('Stripe webhook signing secret is not configured')
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    // Never log the payload, signature, or secret. The reason helps distinguish
    // an expired replay from a different endpoint's signing secret.
    console.error('Stripe webhook signature verification failed', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') break
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription : session.subscription?.id
        const customerId = customerIdOf(session.customer)
        if (!subscriptionId || !customerId) throw new Error('Checkout lacks a subscription or customer')
        await syncSubscription(subscriptionId, customerId)
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await syncSubscription(subscription.id)
        break
      }
      case 'invoice.paid': {
        await applyInvoice((event.data.object as Stripe.Invoice).id)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = await stripe.invoices.retrieve((event.data.object as Stripe.Invoice).id)
        const subscriptionId = subscriptionIdOfInvoice(invoice)
        if (subscriptionId) await syncSubscription(subscriptionId)
        break
      }
    }
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook processing failed', event.id, error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
