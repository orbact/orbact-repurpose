import { extractRateLimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractFromUrl, extractFromYoutube, extractFromText } from '@/lib/extract'

export async function POST(req: NextRequest) {
  // Require a logged-in user — no anonymous extraction, this is also your first line of abuse defense
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

  const body = await req.json().catch(() => null)
  if (!body?.type || !body?.input) {
    return NextResponse.json({ error: 'Missing type or input' }, { status: 400 })
  }

  const { type, input } = body as { type: string; input: string }

  try {
    let result
    if (type === 'url') result = await extractFromUrl(input)
    else if (type === 'youtube') result = await extractFromYoutube(input)
    else if (type === 'text') result = extractFromText(input)
    else return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}