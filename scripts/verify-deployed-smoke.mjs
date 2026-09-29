import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

nextEnv.loadEnvConfig(process.cwd())
if (process.env.ACCEPTANCE_ALLOW_TEST_MUTATIONS !== 'yes') {
  throw new Error('Set ACCEPTANCE_ALLOW_TEST_MUTATIONS=yes only when the deployed app uses the sandbox Supabase project.')
}

const origin = process.env.ACCEPTANCE_APP_URL || 'https://orbact-repurpose.vercel.app'
const email = `orbact-smoke-${randomUUID()}@example.com`
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function request(path, options) {
  return fetch(new URL(path, origin), { ...options, signal: AbortSignal.timeout(15_000) })
}

try {
  for (const path of ['/', '/login', '/services', '/contact', '/privacy', '/terms']) {
    const response = await request(path)
    assert.equal(response.status, 200, `${path} returned ${response.status}`)
  }
  console.log('PASS: public pages load over HTTPS')

  for (const path of ['/api/generate', '/api/calendar', '/api/extract']) {
    const response = await request(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    assert.equal(response.status, 401, `${path} returned ${response.status}`)
  }
  assert.equal((await request('/api/cron/publish')).status, 401)
  console.log('PASS: generation, calendar, extraction, and cron reject anonymous calls')

  const response = await request('/api/contact', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Orbact acceptance probe', email, company: 'Orbact test', service: 'unsure',
      challenge: 'This is an automated sandbox acceptance probe for the contact form.',
    }),
  })
  assert.equal(response.status, 200, `Contact API returned ${response.status}`)
  const { data, error } = await admin.from('agency_inquiries').select('id,status').eq('email', email).single()
  if (error) throw error
  assert.equal(data.status, 'new')
  console.log('PASS: contact API writes an inquiry to the sandbox database')
} finally {
  const { error } = await admin.from('agency_inquiries').delete().eq('email', email)
  if (error) console.error(`CLEANUP FAILED for temporary inquiry: ${error.message}`)
}
