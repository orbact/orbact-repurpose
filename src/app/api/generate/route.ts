import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AIProviderBusyError, generateRepurposedContent } from '@/lib/ai/generate-content'
import { MAX_INPUT_CHARS } from '@/lib/extract'
import { readJsonBody, RequestBodyError } from '@/lib/http/read-json'
import { generateRateLimit } from '@/lib/rate-limit'
import { parseGenerationBrief } from '@/lib/ai/content-schema'
import { ensureProfile } from '@/lib/supabase/profile'

export const maxDuration = 60

type Reservation = {
  state: 'reserved' | 'pending' | 'complete' | 'failed' | 'limit'
  id?: string
  outputs?: unknown
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await readJsonBody(req)
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request body' },
      { status }
    )
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const values = body as Record<string, unknown>
  const title = typeof values.title === 'string' ? values.title.trim() : ''
  const sourceText = typeof values.text === 'string' ? values.text.trim() : ''
  const sourceType = values.sourceType ?? 'text'
  const requestId = values.requestId
  const brief = parseGenerationBrief(values.brief ?? {
    audience: '', tone: 'clear', offer: '', cta: '', bannedClaims: '',
  })
  if (!title || title.length > 200 || sourceText.length < 50 || sourceText.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: 'Title must be 1–200 characters and text must be 50–14,000 characters.' },
      { status: 400 }
    )
  }
  if (sourceType !== 'url' && sourceType !== 'youtube' && sourceType !== 'text') {
    return NextResponse.json({ error: 'Invalid source type' }, { status: 400 })
  }
  if (typeof requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 })
  }
  if (!brief) return NextResponse.json({ error: 'Invalid content brief' }, { status: 400 })

  try {
    await ensureProfile(user)
  } catch (error) {
    console.error('Generation profile initialization failed', error)
    return NextResponse.json({ error: 'Could not prepare your account. Please try again.' }, { status: 503 })
  }

  const { success } = await generateRateLimit.limit(user.id)
  if (!success) {
    return NextResponse.json({ error: 'Too many generations. Try again in a minute.' }, { status: 429 })
  }

  const admin = createAdminClient()
  const { data, error: reserveError } = await admin.rpc('reserve_generation', {
    p_user_id: user.id,
    p_request_id: requestId,
    p_title: title,
    p_input_type: sourceType,
    p_input_raw: sourceText,
    p_brief: brief,
  })
  if (reserveError) {
    console.error('Generation reservation failed', reserveError)
    return NextResponse.json({ error: 'Could not reserve a generation.' }, { status: 503 })
  }
  const reservation = data as Reservation | null
  if (!reservation) return NextResponse.json({ error: 'Could not reserve a generation.' }, { status: 503 })
  if (reservation.state === 'limit') {
    return NextResponse.json({ error: 'Generation limit reached for your plan.' }, { status: 403 })
  }
  if (reservation.state === 'complete') {
    return NextResponse.json({ id: reservation.id, outputs: reservation.outputs })
  }
  if (reservation.state === 'pending') {
    return NextResponse.json({ error: 'This generation is still processing. Check your history shortly.' }, { status: 409 })
  }
  if (reservation.state === 'failed') {
    return NextResponse.json({
      error: 'That attempt failed and its credit was refunded. Start a new attempt.',
      creditRefunded: true,
    }, { status: 409 })
  }
  if (reservation.state !== 'reserved' || !reservation.id) {
    return NextResponse.json({ error: 'Unexpected generation state.' }, { status: 503 })
  }

  try {
    const outputs = await generateRepurposedContent(title, sourceText, brief)
    const { data: finishState, error: finishError } = await admin.rpc('finish_generation', {
      p_user_id: user.id,
      p_request_id: requestId,
      p_outputs: outputs,
      p_success: true,
    })
    if (finishError || finishState !== 'complete') throw finishError ?? new Error('Could not save generation')
    return NextResponse.json({ id: reservation.id, outputs })
  } catch (error) {
    const { data: current } = await admin.rpc('reserve_generation', {
      p_user_id: user.id,
      p_request_id: requestId,
      p_title: title,
      p_input_type: sourceType,
      p_input_raw: sourceText,
      p_brief: brief,
    })
    const currentState = current as Reservation | null
    if (currentState?.state === 'complete') {
      return NextResponse.json({ id: currentState.id, outputs: currentState.outputs })
    }
    const { data: refundState, error: refundError } = await admin.rpc('finish_generation', {
      p_user_id: user.id,
      p_request_id: requestId,
      p_outputs: null,
      p_success: false,
    })
    console.error('Generation failed', error instanceof Error
      ? { name: error.name, message: error.message.slice(0, 240) }
      : { name: 'Unknown error' })
    if (refundError || refundState !== 'failed') {
      console.error('Generation refund could not be confirmed; stale reservation will be recovered', refundError)
      return NextResponse.json({
        error: 'Could not confirm this attempt. Check your history, then retry the same request.',
        creditRefunded: false,
      }, { status: 503 })
    }
    if (error instanceof AIProviderBusyError) {
      return NextResponse.json({
        error: `The free AI service is busy. Your credit was refunded. Try again in about ${error.retryAfterSeconds} seconds.`,
        creditRefunded: true,
      }, { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } })
    }
    return NextResponse.json({
      error: 'Content creation failed. Your credit was refunded; please try again.',
      creditRefunded: true,
    }, { status: 502 })
  }
}
