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
for (const table of ['profiles', 'generations', 'publish_queue', 'agency_inquiries']) {
  const properties = schema.definitions?.[table]?.properties
  console.log(table + ': ' + (properties
    ? Object.entries(properties).map(([name, spec]) =>
      name + ' (' + (spec.format || spec.type || 'unknown') + ')').join(', ')
    : 'not exposed'))
}
for (const name of ['try_consume_generation', 'reserve_generation', 'finish_generation', 'apply_paid_invoice']) {
  console.log(name + ': ' + (Object.keys(schema.paths || {}).some((path) => path.includes('/rpc/' + name)) ? 'present' : 'absent'))
}
