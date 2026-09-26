import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import ExtractTest from './extract-test'
import { UpgradeButtons, ManageBillingButton } from './upgrade-buttons'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const usagePercent = profile
    ? Math.min(100, (profile.generations_used / profile.generations_limit) * 100)
    : 0

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
          <span className="text-sm text-muted">{user.email}</span>
        </nav>

        <div className="max-w-4xl mx-auto px-6 py-10">
          {/* Account summary card */}
          <div className="glass-card p-6 mb-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-muted mb-1">Current plan</p>
                <p className="text-xl font-semibold capitalize">{profile?.plan}</p>
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
                {profile?.plan === 'free' ? <UpgradeButtons /> : <ManageBillingButton />}
              </div>
            </div>

            {profile?.subscription_ends_at && (
              <p className="text-warning text-sm mt-4 pt-4 border-t border-border">
                Your plan ends on{' '}
                {new Date(profile.subscription_ends_at).toLocaleDateString()} — you'll keep
                access until then.
              </p>
            )}
          </div>

          <ExtractTest />
        </div>
      </div>
    </div>
  )
}