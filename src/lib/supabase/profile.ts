import { createAdminClient } from './admin'

type AuthenticatedUser = { id: string; email?: string | null }

// Auth triggers should create profiles, but accounts predating a migration may
// be missing one. Only call this with a user returned by auth.getUser().
export async function ensureProfile(user: AuthenticatedUser) {
  const admin = createAdminClient()
  const existing = await admin.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data

  const { error: insertError } = await admin.from('profiles')
    .insert({ id: user.id, email: user.email ?? null })
  // A simultaneous request may have created the row after our first read.
  if (insertError && insertError.code !== '23505') throw insertError

  const created = await admin.from('profiles').select('*').eq('id', user.id).single()
  if (created.error || !created.data) throw created.error ?? new Error('Profile creation failed')
  return created.data
}
