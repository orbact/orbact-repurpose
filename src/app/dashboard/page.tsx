import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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

  return (
    <div style={{ padding: 40 }}>
      <h1>Dashboard</h1>
      <p>Logged in as: {user.email}</p>
      <p>Plan: {profile?.plan}</p>
      <p>Generations used: {profile?.generations_used} / {profile?.generations_limit}</p>

      {profile?.subscription_ends_at && (
        <p style={{ color: '#e0a030' }}>
          Your plan ends on {new Date(profile.subscription_ends_at).toLocaleDateString()} — you'll keep access until then.
        </p>
      )}

      <div style={{ marginTop: 20 }}>
        {profile?.plan === 'free' ? <UpgradeButtons /> : <ManageBillingButton />}
      </div>

      <ExtractTest />
    </div>
  )
}