// Read-only diagnostic. Prints counts only; never prints customer data or keys.
import env from '@next/env'
import { createClient } from '@supabase/supabase-js'

env.loadEnvConfig(process.cwd())
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Supabase URL or server key is not configured.')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false } })
const userIds = new Set()
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) throw error
  for (const user of data.users) userIds.add(user.id)
  if (data.users.length < 1000) break
}

const profileIds = new Set()
for (let offset = 0; ; offset += 1000) {
  const { data, error } = await admin.from('profiles').select('id')
    .order('id').range(offset, offset + 999)
  if (error) throw error
  for (const profile of data) profileIds.add(profile.id)
  if (data.length < 1000) break
}

const missing = [...userIds].filter((id) => !profileIds.has(id)).length
const keyKind = key.startsWith('sb_secret_') ? 'secret' : key.startsWith('eyJ') ? 'legacy JWT' : 'unknown'
console.log(JSON.stringify({ keyKind, authUsers: userIds.size, profiles: profileIds.size, usersWithoutProfile: missing }))
