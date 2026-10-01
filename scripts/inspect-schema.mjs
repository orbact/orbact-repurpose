import env from '@next/env'

env.loadEnvConfig(process.cwd())
const base = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!base || !key) {
  console.error('Supabase URL or service role key is not configured.')
  process.exit(1)
}

const response = await fetch(new URL('/rest/v1/', base), {
  headers: {
    apikey: key,
    Authorization: 'Bearer ' + key,
    Accept: 'application/openapi+json',
  },
})
if (!response.ok) {
  console.error('Schema request failed with HTTP ' + response.status)
  process.exit(1)
}
const schema = await response.json()
let missing = false
const required = {
  profiles: ['id', 'email', 'plan', 'generations_used', 'generations_limit', 'brand_brief'],
  generations: ['id', 'user_id', 'request_id', 'title', 'input_raw', 'outputs', 'status', 'credit_reserved', 'credit_refunded'],
  agency_inquiries: ['id', 'name', 'email', 'service', 'challenge'],
  publish_queue: ['id', 'user_id', 'platform', 'delivery_mode', 'status', 'scheduled_at'],
  publishing_connections: ['id', 'user_id', 'platform', 'external_account_id', 'enabled'],
  stripe_paid_invoices: ['invoice_id', 'customer_id', 'period_end'],
}
for (const [table, columns] of Object.entries(required)) {
  const properties = schema.definitions?.[table]?.properties
  const absent = columns.filter((column) => !properties?.[column])
  console.log(`${absent.length ? 'MISSING' : 'OK'} table ${table}${absent.length ? ': ' + absent.join(', ') : ''}`)
  if (absent.length) missing = true
}
for (const name of ['reserve_generation', 'finish_generation', 'apply_paid_invoice', 'claim_due_posts']) {
  const present = Object.keys(schema.paths || {}).some((path) => path.includes('/rpc/' + name))
  console.log(`${present ? 'OK' : 'MISSING'} function ${name}`)
  if (!present) missing = true
}
if (missing) {
  console.error('Database schema is incomplete. Apply supabase/migrations/202609290001_core.sql to this project, then run the read-only acceptance checks.')
  process.exitCode = 1
}
