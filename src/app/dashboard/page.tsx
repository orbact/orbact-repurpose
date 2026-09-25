import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ExtractTest from './extract-test'

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
      <ExtractTest />
    </div>
  )
}