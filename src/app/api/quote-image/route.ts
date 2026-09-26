import { quoteImageRateLimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { success } = await quoteImageRateLimit.limit(user.id)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down and try again in a minute.' },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => null)
  if (!body?.prompt) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
  }

  const { prompt, seed } = body as { prompt: string; seed?: number }
  const safePrompt = prompt.slice(0, 300) // cap length — cheap abuse protection

  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(
    safePrompt
  )}?model=flux&width=1080&height=1080&seed=${seed ?? 42}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000) // image gen is slower than text

  try {
    let res: Response | null = null
    let lastStatus = 0

    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}`,
        },
      })
      if (res.ok) break

      lastStatus = res.status
      if ((res.status === 429 || res.status === 500) && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
        continue
      }
      break
    }

    if (!res || !res.ok) {
      throw new Error(`Image generation failed (status ${lastStatus || res?.status})`)
    }

    const arrayBuffer = await res.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const contentType = res.headers.get('content-type') || 'image/jpeg'

    return NextResponse.json({ imageDataUrl: `data:${contentType};base64,${base64}` })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Image generation failed'
    return NextResponse.json({ error: message }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}