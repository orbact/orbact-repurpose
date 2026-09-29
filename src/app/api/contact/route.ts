import { NextRequest, NextResponse } from 'next/server'
import { contactRateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { readJsonBody, RequestBodyError } from '@/lib/http/read-json'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await readJsonBody(req, 5_000)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request' },
      { status: error instanceof RequestBodyError ? error.status : 400 }
    )
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const values = body as Record<string, unknown>
  if (values.website) return NextResponse.json({ received: true })
  const name = typeof values.name === 'string' ? values.name.trim() : ''
  const email = typeof values.email === 'string' ? values.email.trim().toLowerCase() : ''
  const company = typeof values.company === 'string' ? values.company.trim() : ''
  const service = values.service
  const challenge = typeof values.challenge === 'string' ? values.challenge.trim() : ''
  if (!name || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 || company.length > 120 ||
      (service !== 'automation' && service !== 'agents' && service !== 'development' && service !== 'unsure') ||
      challenge.length < 20 || challenge.length > 3_000) {
    return NextResponse.json({ error: 'Check the form fields and describe your project in at least 20 characters.' }, { status: 400 })
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = await contactRateLimit.limit(ip)
  if (!success) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })

  const { error } = await createAdminClient().from('agency_inquiries')
    .insert({ name, email, company, service, challenge })
  if (error) {
    console.error('Could not save agency inquiry', error)
    return NextResponse.json({ error: 'Could not send your inquiry. Please email Orbact directly.' }, { status: 503 })
  }
  return NextResponse.json({ received: true })
}
