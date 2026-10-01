import { billingRateLimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe, PLAN_PRICES } from '@/lib/stripe'
import { billingMode } from '@/lib/billing/config'
import { getSiteUrl } from '@/lib/site-url'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureProfile } from '@/lib/supabase/profile'

export async function POST(req: NextRequest) {
  if (billingMode() === 'disabled') {
    return NextResponse.json({ error: 'Paid plans are not available yet.' }, { status: 503 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { success } = await billingRateLimit.limit(user.id)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down and try again in a minute.' },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => null)
  const plan: unknown = body?.plan
  if (plan !== 'starter' && plan !== 'pro') {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  let profile: Awaited<ReturnType<typeof ensureProfile>>
  try {
    profile = await ensureProfile(user)
  } catch (error) {
    console.error('Billing profile initialization failed', error)
    return NextResponse.json({ error: 'Could not prepare your billing account. Please try again.' }, { status: 503 })
  }
  if (profile.stripe_subscription_id) {
    return NextResponse.json(
      { error: 'Manage your existing subscription in the billing portal.' },
      { status: 409 }
    )
  }

  try {
    const stripe = getStripe()
    const origin = getSiteUrl()
    let customerId = profile.stripe_customer_id as string | null

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email || user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      const { error: updateError } = await createAdminClient()
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
      if (updateError) throw updateError
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PLAN_PRICES[plan].priceId, quantity: 1 }],
      success_url: origin + '/dashboard?checkout=success',
      cancel_url: origin + '/dashboard?checkout=cancelled',
      metadata: { supabase_user_id: user.id, plan },
    })
    if (!session.url) throw new Error('Stripe did not return a checkout URL')

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout creation failed', error)
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 502 })
  }
}
