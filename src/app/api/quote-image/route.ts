import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { quoteImageRateLimit } from '@/lib/rate-limit'
import { readJsonBody, RequestBodyError } from '@/lib/http/read-json'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_IMAGE_BYTES = 3_000_000
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function POST(req: NextRequest) {
  const apiKey = process.env.POLLINATIONS_API_KEY
  if (process.env.ENABLE_QUOTE_IMAGES !== 'true' || !apiKey) {
    return NextResponse.json({ error: 'AI image generation is not configured.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await readJsonBody(req, 1_000)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request body' },
      { status: error instanceof RequestBodyError ? error.status : 400 }
    )
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { prompt, seed } = body as Record<string, unknown>
  const cleanPrompt = typeof prompt === 'string' ? prompt.trim() : ''
  if (cleanPrompt.length < 12 || cleanPrompt.length > 300) {
    return NextResponse.json({ error: 'Describe the image in 12–300 characters.' }, { status: 400 })
  }
  if (seed !== undefined && (!Number.isInteger(seed) || Number(seed) < 0 || Number(seed) > 999_999_999)) {
    return NextResponse.json({ error: 'Invalid image seed.' }, { status: 400 })
  }

  const { success } = await quoteImageRateLimit.limit(user.id)
  if (!success) {
    return NextResponse.json({ error: 'Image limit reached. Try again later.' }, { status: 429 })
  }

  const url = new URL(`https://gen.pollinations.ai/image/${encodeURIComponent(cleanPrompt)}`)
  url.searchParams.set('model', 'flux')
  url.searchParams.set('width', '768')
  url.searchParams.set('height', '768')
  url.searchParams.set('seed', String(seed ?? Math.floor(Math.random() * 1_000_000_000)))

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'image/jpeg,image/png,image/webp' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
      console.error('Image provider returned', response.status)
      return NextResponse.json({ error: 'The image provider could not generate this image.' }, { status: 502 })
    }
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || ''
    if (!IMAGE_TYPES.has(contentType) || !response.body) {
      return NextResponse.json({ error: 'The image provider returned an invalid image.' }, { status: 502 })
    }
    const chunks: Uint8Array[] = []
    let size = 0
    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel()
        return NextResponse.json({ error: 'The generated image is too large.' }, { status: 502 })
      }
      chunks.push(value)
    }
    if (size === 0) return NextResponse.json({ error: 'The image provider returned an empty image.' }, { status: 502 })
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return new NextResponse(bytes, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch (error) {
    console.error('Image generation failed', error)
    return NextResponse.json({ error: 'Image generation timed out or could not connect. Try again later.' }, { status: 502 })
  }
}
