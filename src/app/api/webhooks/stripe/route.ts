import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLAN_PRICES } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Service-role client — webhooks have no user session, so we bypass RLS
// deliberately here using the secret key, never the anon key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_user_id
      const plan = session.metadata?.plan as 'starter' | 'pro'
      if (!userId || !plan) break

      await supabaseAdmin
        .from('profiles')
        .update({
          plan,
          generations_limit: PLAN_PRICES[plan].limit,
          stripe_subscription_id: session.subscription as string,
          subscription_status: 'active',
          subscription_ends_at: null,
        })
        .eq('id', userId)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      // Stripe's current cancellation flow sets `cancel_at` directly to the
      // scheduled end timestamp, rather than relying on the older
      // cancel_at_period_end boolean — this is the reliable signal to check
      const endsAt = subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null

      await supabaseAdmin
        .from('profiles')
        .update({
          subscription_status: subscription.status,
          subscription_ends_at: endsAt,
        })
        .eq('stripe_customer_id', customerId)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      await supabaseAdmin
        .from('profiles')
        .update({
          plan: 'free',
          generations_limit: 3,
          subscription_status: 'cancelled',
          stripe_subscription_id: null,
          subscription_ends_at: null,
        })
        .eq('stripe_customer_id', customerId)
      break
    }
  }

  return NextResponse.json({ received: true })
}