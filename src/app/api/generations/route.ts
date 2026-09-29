import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseGeneratedContent } from '@/lib/ai/content-schema'
import { readJsonBody, RequestBodyError } from '@/lib/http/read-json'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function userId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function bodyOf(req: NextRequest): Promise<Record<string, unknown> | NextResponse> {
  try {
    const body = await readJsonBody(req, 40_000)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    return body as Record<string, unknown>
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request body' },
      { status: error instanceof RequestBodyError ? error.status : 400 }
    )
  }
}

export async function GET() {
  const id = await userId()
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await createAdminClient()
    .from('generations')
    .select('id,title,input_type,input_raw,outputs,status,created_at')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) return NextResponse.json({ error: 'Could not load history' }, { status: 503 })
  return NextResponse.json({ generations: data })
}

export async function PATCH(req: NextRequest) {
  const id = await userId()
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await bodyOf(req)
  if (body instanceof NextResponse) return body
  if (typeof body.id !== 'string' || !UUID.test(body.id)) {
    return NextResponse.json({ error: 'Invalid generation ID' }, { status: 400 })
  }
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200) {
      return NextResponse.json({ error: 'Title must be 1–200 characters' }, { status: 400 })
    }
    update.title = body.title.trim()
  }
  if (body.outputs !== undefined) {
    const outputs = parseGeneratedContent(body.outputs)
    if (!outputs) return NextResponse.json({ error: 'Invalid draft content' }, { status: 400 })
    update.outputs = outputs
  }
  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })
  }
  const { data, error } = await createAdminClient()
    .from('generations')
    .update(update)
    .eq('id', body.id)
    .eq('user_id', id)
    .eq('status', 'complete')
    .select('id,title,outputs')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Could not save this draft' }, { status: 404 })
  return NextResponse.json({ generation: data })
}

export async function DELETE(req: NextRequest) {
  const id = await userId()
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await bodyOf(req)
  if (body instanceof NextResponse) return body
  if (typeof body.id !== 'string' || !UUID.test(body.id)) {
    return NextResponse.json({ error: 'Invalid generation ID' }, { status: 400 })
  }
  const { data, error } = await createAdminClient()
    .from('generations')
    .delete()
    .eq('id', body.id)
    .eq('user_id', id)
    .neq('status', 'pending')
    .select('id')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Could not delete this draft' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
