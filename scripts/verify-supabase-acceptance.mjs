import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

nextEnv.loadEnvConfig(process.cwd())

if (process.env.ACCEPTANCE_ALLOW_TEST_MUTATIONS !== 'yes') {
  throw new Error('Set ACCEPTANCE_ALLOW_TEST_MUTATIONS=yes only for the sandbox Supabase project.')
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !publicKey || !secretKey) throw new Error('Supabase environment variables are incomplete.')

const admin = createClient(url, secretKey, { auth: { persistSession: false } })
const accounts = []

function checked(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

async function createTestAccount() {
  const email = `orbact-acceptance-${randomUUID()}@example.com`
  const password = randomUUID() + randomUUID()
  const created = checked(await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  }), 'Create test user')
  assert.ok(created.user?.id)
  accounts.push(created.user.id)
  const client = createClient(url, publicKey, { auth: { persistSession: false } })
  checked(await client.auth.signInWithPassword({ email, password }), 'Sign in test user')
  return { id: created.user.id, client }
}

async function profile(id) {
  return checked(await admin.from('profiles')
    .select('id,plan,generations_used,generations_limit')
    .eq('id', id).single(), 'Read profile')
}

try {
  const a = await createTestAccount()
  const b = await createTestAccount()
  assert.deepEqual(await profile(a.id), {
    id: a.id, plan: 'free', generations_used: 0, generations_limit: 3,
  })
  assert.deepEqual(await profile(b.id), {
    id: b.id, plan: 'free', generations_used: 0, generations_limit: 3,
  })
  console.log('PASS: email sign-in and free profiles for two temporary users')

  const own = checked(await a.client.from('profiles').select('id').eq('id', a.id), 'Read own profile')
  const other = checked(await a.client.from('profiles').select('id').eq('id', b.id), 'Read other profile')
  assert.equal(own.length, 1)
  assert.equal(other.length, 0)
  const forbiddenUpdate = await a.client.from('profiles').update({ plan: 'pro' }).eq('id', a.id)
  assert.ok(forbiddenUpdate.error, 'Client profile updates must fail')
  assert.equal((await profile(a.id)).plan, 'free')
  const forbiddenQueue = await a.client.from('publish_queue').select('id')
  assert.ok(forbiddenQueue.error, 'Client queue access must fail')
  const forbiddenClaim = await a.client.rpc('claim_due_posts', { p_limit: 1 })
  assert.ok(forbiddenClaim.error, 'Client cron RPC must fail')
  console.log('PASS: profile isolation and blocked billing, queue, and cron access')

  const requestId = randomUUID()
  const params = {
    p_user_id: a.id,
    p_request_id: requestId,
    p_title: 'Acceptance source',
    p_input_type: 'text',
    p_input_raw: 'A sample source with enough detail for a credit reservation.',
    p_brief: { audience: 'founders', tone: 'clear', offer: '', cta: '', bannedClaims: '' },
  }
  const forbiddenReserve = await a.client.rpc('reserve_generation', params)
  assert.ok(forbiddenReserve.error, 'Client credit reservation must fail')
  const first = checked(await admin.rpc('reserve_generation', params), 'Reserve credit')
  const duplicate = checked(await admin.rpc('reserve_generation', params), 'Repeat reservation')
  assert.equal(first.state, 'reserved')
  assert.equal(duplicate.state, 'pending')
  assert.equal((await profile(a.id)).generations_used, 1)
  const finished = checked(await admin.rpc('finish_generation', {
    p_user_id: a.id, p_request_id: requestId, p_outputs: null, p_success: false,
  }), 'Refund failed generation')
  assert.equal(finished, 'failed')
  checked(await admin.rpc('finish_generation', {
    p_user_id: a.id, p_request_id: requestId, p_outputs: null, p_success: false,
  }), 'Repeat refund')
  assert.equal((await profile(a.id)).generations_used, 0)
  console.log('PASS: duplicate reservation and duplicate failure refund count once')

  const seeded = checked(await admin.from('publish_queue').insert([
    { user_id: a.id, platform: 'linkedin', content: 'A private acceptance draft for user A.', scheduled_at: new Date().toISOString() },
    { user_id: b.id, platform: 'facebook', content: 'A private acceptance draft for user B.', scheduled_at: new Date().toISOString() },
  ]).select('id,user_id'), 'Seed temporary calendar rows')
  assert.equal(seeded.length, 2)
  const directCalendarRead = await a.client.from('publish_queue').select('id')
  assert.ok(directCalendarRead.error, 'Browser clients must not access service-only calendar rows')
  console.log('PASS: calendar table remains server-only for both users')
} finally {
  for (const id of accounts.reverse()) {
    const result = await admin.auth.admin.deleteUser(id)
    if (result.error) console.error(`CLEANUP FAILED for temporary user ${id}: ${result.error.message}`)
  }
}
