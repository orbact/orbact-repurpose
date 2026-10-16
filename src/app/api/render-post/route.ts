import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readJsonBody, RequestBodyError } from '@/lib/http/read-json'
import { postDesignRateLimit } from '@/lib/rate-limit'
import { POST_DESIGNS, parsePostDesignInput, trustedTemplateImageUrl } from '@/lib/post-designs'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_IMAGE_BYTES = 4_000_000

async function downloadJpeg(value: string) {
  let url = trustedTemplateImageUrl(value)
  if (!url) throw new Error('Untrusted image URL')
  for (let hop = 0; hop < 3; hop += 1) {
    const response = await fetch(url, { cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(15_000) })
    if (response.status >= 300 && response.status < 400) {
      url = trustedTemplateImageUrl(response.headers.get('location') || '')
      if (!url) throw new Error('Untrusted image redirect')
      continue
    }
    if (!response.ok || !response.body || Number(response.headers.get('content-length') || 0) > MAX_IMAGE_BYTES) {
      throw new Error('Image download failed')
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
        throw new Error('Image is too large')
      }
      chunks.push(value)
    }
    const image = Buffer.concat(chunks)
    if (image.length < 4 || image[0] !== 0xff || image[1] !== 0xd8 ||
        image[image.length - 2] !== 0xff || image[image.length - 1] !== 0xd9) {
      throw new Error('Provider did not return a JPEG')
    }
    return image
  }
  throw new Error('Too many image redirects')
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: unknown
  try { raw = await readJsonBody(req, 2_500) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request body' },
      { status: error instanceof RequestBodyError ? error.status : 400 })
  }
  const input = parsePostDesignInput(raw)
  if (!input) return NextResponse.json({ error: 'Choose a design and review its headline and text.' }, { status: 400 })
  const template = POST_DESIGNS.find((design) => design.id === input.design)!
  const templateId = process.env[template.env]
  const apiKey = process.env.APITEMPLATE_API_KEY
  if (!apiKey || !templateId) return NextResponse.json({ error: 'Image templates are not configured yet.' }, { status: 503 })
  if (input.artworkUrl) {
    let artwork: URL
    try { artwork = new URL(input.artworkUrl) } catch {
      return NextResponse.json({ error: 'Choose artwork uploaded by this account.' }, { status: 400 })
    }
    if (artwork.protocol !== 'https:' || artwork.hostname !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname ||
        !artwork.pathname.startsWith(`/storage/v1/object/public/publishing/${user.id}/`) ||
        !artwork.pathname.endsWith('.jpg') || artwork.search || artwork.hash) {
      return NextResponse.json({ error: 'Choose artwork uploaded by this account.' }, { status: 400 })
    }
  }
  const { success } = await postDesignRateLimit.limit('shared-free-plan')
  if (!success) return NextResponse.json({ error: 'The free image-render allowance is reached. Try again later.' }, { status: 429 })

  try {
    const overrides: Array<{ name: string; text?: string; src?: string }> = [
      { name: 'headline', text: input.headline },
      { name: 'kicker', text: input.kicker },
      { name: 'body', text: input.body },
    ]
    if (input.artworkUrl && input.design === 'technology') overrides.push({ name: 'background_image', src: input.artworkUrl })
    const response = await fetch(`https://rest.apitemplate.io/v2/create-image?template_id=${encodeURIComponent(templateId)}`, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides }),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(40_000),
    })
    if (!response.ok) {
      console.error('Post design provider returned', response.status)
      return NextResponse.json({ error: response.status === 429 ? 'The free image-render allowance is exhausted.' : 'Could not render this design. Try again shortly.' },
        { status: response.status === 429 ? 429 : 502 })
    }
    const data = await response.json() as { status?: string; download_url?: string }
    if (data.status !== 'success' || !data.download_url) throw new Error('Invalid image response')
    const image = await downloadJpeg(data.download_url)
    const path = `${user.id}/${randomUUID()}.jpg`
    const admin = createAdminClient()
    const { error } = await admin.storage.from('publishing').upload(path, image, {
      contentType: 'image/jpeg', cacheControl: '3600', upsert: false,
    })
    if (error) throw new Error(`Image storage failed: ${error.message}`)
    const { data: stored } = admin.storage.from('publishing').getPublicUrl(path)
    return NextResponse.json({ url: stored.publicUrl, design: input.design })
  } catch (error) {
    console.error('Post design rendering failed', error)
    return NextResponse.json({ error: 'The design could not be finished or saved. Try again.' }, { status: 502 })
  }
}
