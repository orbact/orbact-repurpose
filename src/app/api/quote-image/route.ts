import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { quoteImageRateLimit } from '@/lib/rate-limit'
import { readJsonBody, RequestBodyError } from '@/lib/http/read-json'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_IMAGE_BYTES = 3_000_000
const MAX_RESPONSE_BYTES = 5_000_000

function imageType(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

export async function POST(req: NextRequest) {
  const apiToken = process.env.CLOUDFLARE_AI_API_TOKEN
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (process.env.ENABLE_QUOTE_IMAGES !== 'true' || !apiToken || !accountId || !/^[a-f0-9]{32}$/i.test(accountId)) {
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

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        prompt: `${cleanPrompt}. Visual artwork only: no lettering, words, logos, watermarks, numbers, or interface text.`,
        steps: 4,
        seed: seed ?? Math.floor(Math.random() * 1_000_000_000),
      }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(45_000),
    })
    if (!response.ok) {
      const providerError = await response.json().catch(() => null) as { errors?: Array<{ code?: unknown; message?: unknown }> } | null
      const diagnostic = Array.isArray(providerError?.errors)
        ? providerError.errors.slice(0, 2).map((item) => ({
          code: typeof item.code === 'number' ? item.code : null,
          message: typeof item.message === 'string' ? item.message.slice(0, 160) : null,
        }))
        : []
      console.error('Image provider returned', response.status, diagnostic)
      if (response.status === 429) return NextResponse.json({ error: 'The free image quota is exhausted. Use the branded card or try again tomorrow.' }, { status: 429 })
      return NextResponse.json({ error: 'The image provider could not generate this image.' }, { status: 502 })
    }
    if (!response.body || Number(response.headers.get('content-length') ?? 0) > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: 'The image provider returned an invalid image.' }, { status: 502 })
    }
    const chunks: Uint8Array[] = []
    let size = 0
    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel()
        return NextResponse.json({ error: 'The generated image is too large.' }, { status: 502 })
      }
      chunks.push(value)
    }
    if (size === 0) return NextResponse.json({ error: 'The image provider returned an empty image.' }, { status: 502 })
    const result = JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8')) as {
      success?: boolean
      result?: { image?: unknown }
    }
    const encoded = result.success ? result.result?.image : undefined
    if (typeof encoded !== 'string' || encoded.length > MAX_RESPONSE_BYTES || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      return NextResponse.json({ error: 'The image provider returned an invalid image.' }, { status: 502 })
    }
    const bytes = Buffer.from(encoded, 'base64')
    const contentType = imageType(bytes)
    if (!contentType || bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'The image provider returned an invalid image.' }, { status: 502 })
    }
    return new NextResponse(bytes, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch (error) {
    console.error('Image generation failed', error)
    return NextResponse.json({ error: 'Image generation timed out or could not connect. Try again later.' }, { status: 502 })
  }
}
