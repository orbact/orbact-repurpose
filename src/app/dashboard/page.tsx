import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import ExtractTest from './extract-test'
import { UpgradeButtons, ManageBillingButton } from './upgrade-buttons'
import SignOutButton from './sign-out-button'
import { parseGenerationBrief } from '@/lib/ai/content-schema'
import { ensureProfile } from '@/lib/supabase/profile'
import { billingMode } from '@/lib/billing/config'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const { checkout } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let profile: Awaited<ReturnType<typeof ensureProfile>> | null = null
  try {
    profile = await ensureProfile(user)
  } catch (error) {
    console.error('Dashboard profile initialization failed', error)
  }

  const usagePercent = profile
    ? Math.min(100, (profile.generations_used / Math.max(1, profile.generations_limit)) * 100)
    : 0
  const billing = billingMode()
  const sandboxSubscription = Boolean(profile?.stripe_subscription_id && process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="gradient-orb orb-violet w-[450px] h-[450px] -top-40 -left-40" />

      <div className="relative z-10">
        <nav className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-border">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Orbact" width={28} height={28} />
            <span className="font-semibold">
              Orbact <span className="text-muted font-normal">Repurpose</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 flex-wrap justify-end">
            <span className="text-sm text-muted break-all">{user.email}</span>
            <SignOutButton />
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Your content studio</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Create once. Show up everywhere.</h1>
              <p className="text-muted mt-2">Turn real source material into polished drafts you can review and publish.</p>
            </div>
            <span className="text-xs text-muted border border-border rounded-full px-3 py-2 self-start">Private workspace</span>
          </div>
          {checkout === 'success' && <p role="status" className="rounded-xl border border-success/30 bg-success/10 text-success text-sm p-4 mb-6">Checkout completed. Your plan will appear here as soon as Stripe confirms it.</p>}
          {checkout === 'cancelled' && <p role="status" className="rounded-xl border border-border bg-white/5 text-muted text-sm p-4 mb-6">Checkout was cancelled. Your current plan is unchanged.</p>}
          {billing === 'test' && <p role="status" className="rounded-xl border border-warning/30 bg-warning/10 text-warning text-sm p-4 mb-6">Billing test mode is active. Checkout uses Stripe test payments.</p>}
          {sandboxSubscription && billing === 'disabled' && <p role="status" className="rounded-xl border border-warning/30 bg-warning/10 text-warning text-sm p-4 mb-6">This account has an existing Stripe test subscription. You can manage that test subscription, while new checkout is paused.</p>}
          {!profile && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 text-danger text-sm p-4 mb-6">Your account could not be loaded. Please try again shortly.</p>}
          {/* Account summary card */}
          <div className="glass-card p-6 mb-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-muted mb-1">Current plan</p>
                <p className="text-xl font-semibold capitalize">{profile?.plan ?? 'Unavailable'}</p>
                {profile?.subscription_status === 'past_due' && <p className="text-danger text-xs mt-1">Payment needs attention in the billing portal.</p>}
              </div>

              <div className="flex-1 min-w-[180px] max-w-xs">
                <div className="flex justify-between text-sm text-muted mb-1">
                  <span>Generations</span>
                  <span>{profile?.generations_used} / {profile?.generations_limit}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>

              <div>
                {profile && (profile.stripe_subscription_id
                  ? <ManageBillingButton />
                  : billing === 'disabled' ? <p className="text-xs text-muted">Paid plans are coming soon.</p> : <UpgradeButtons />)}
              </div>
            </div>

            {profile?.subscription_ends_at && (
              <p className="text-warning text-sm mt-4 pt-4 border-t border-border">
                Your plan ends on{' '}
                {new Date(profile.subscription_ends_at).toLocaleDateString()} — you&apos;ll keep
                access until then.
              </p>
            )}
            {profile?.renewal_at && !profile?.subscription_ends_at && profile.plan !== 'free' && (
              <p className="text-muted text-sm mt-4 pt-4 border-t border-border">
                Credits renew after payment for the next billing period, expected around{' '}
                {new Date(profile.renewal_at).toLocaleDateString()}.
              </p>
            )}
          </div>

          <ExtractTest
            initialBrief={parseGenerationBrief(profile?.brand_brief)}
            imageGenerationEnabled={process.env.ENABLE_QUOTE_IMAGES === 'true' && Boolean(process.env.POLLINATIONS_API_KEY)}
          />
        </div>
      </div>
    </div>
  )
}
