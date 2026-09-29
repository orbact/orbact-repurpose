// Restores only missing default profiles for existing Supabase Auth users.
// Dry run by default; pass --apply to insert. Never updates existing profiles.
import env from '@next/env'
import { createClient } from '@supabase/supabase-js'

env.loadEnvConfig(process.cwd())
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase server configuration is missing')
const admin = createClient(url, key, { auth: { persistSession: false } })

const users = []
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) throw error
  users.push(...data.users)
  if (data.users.length < 1000) break
}
const existing = new Set()
for (let offset = 0; ; offset += 1000) {
  const { data, error } = await admin.from('profiles').select('id')
    .order('id').range(offset, offset + 999)
  if (error) throw error
  for (const profile of data) existing.add(profile.id)
  if (data.length < 1000) break
}
const missing = users.filter((user) => !existing.has(user.id))
console.log(JSON.stringify({ project: new URL(url).hostname, missingProfiles: missing.length, mode: process.argv.includes('--apply') ? 'apply' : 'dry-run' }))
if (!process.argv.includes('--apply') || missing.length === 0) process.exit(0)

for (let offset = 0; offset < missing.length; offset += 100) {
  const batch = missing.slice(offset, offset + 100).map((user) => ({ id: user.id, email: user.email ?? null }))
  const { error } = await admin.from('profiles').upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw error
}
console.log(JSON.stringify({ insertedDefaultsFor: missing.length }))
