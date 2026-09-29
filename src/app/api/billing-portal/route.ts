import { billingRateLimit } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { getSiteUrl } from '@/lib/site-url'

export async function POST() {
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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: getSiteUrl() + '/dashboard',
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Billing portal creation failed', error)
    return NextResponse.json(
      { error: 'Could not open billing portal. Please try again.' },
      { status: 502 }
    )
  }
}
