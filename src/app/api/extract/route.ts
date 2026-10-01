import { extractRateLimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractFromUrl, extractFromYoutube, extractFromText, MAX_INPUT_CHARS } from '@/lib/extract'
import { normalizeSourceUrl, sourceTypeForUrl } from '@/lib/source-url'
import { readJsonBody, RequestBodyError } from '@/lib/http/read-json'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { success } = await extractRateLimit.limit(user.id)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down and try again in a minute.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await readJsonBody(req)
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400
    const message = error instanceof Error ? error.message : 'Invalid request body'
    return NextResponse.json({ error: message }, { status })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { type, input } = body as Record<string, unknown>
  if (type !== 'url' && type !== 'youtube' && type !== 'text') {
    return NextResponse.json({ error: 'Invalid input type' }, { status: 400 })
  }
  if (typeof input !== 'string' || !input.trim()) {
    return NextResponse.json({ error: 'Input is required' }, { status: 400 })
  }
  if (type === 'text' && input.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: 'Text must be 14,000 characters or fewer' },
      { status: 413 }
    )
  }
  if (type !== 'text' && input.length > 2048) {
    return NextResponse.json({ error: 'URL is too long' }, { status: 413 })
  }

  try {
    const normalizedInput = type === 'text' ? input : normalizeSourceUrl(input)
    const effectiveType = type === 'url' ? sourceTypeForUrl(normalizedInput) : type
    const result = effectiveType === 'youtube'
      ? await extractFromYoutube(normalizedInput)
      : effectiveType === 'url'
        ? await extractFromUrl(normalizedInput)
        : extractFromText(input)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Extraction failed'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
