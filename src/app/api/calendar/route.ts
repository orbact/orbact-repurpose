import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readJsonBody, RequestBodyError } from '@/lib/http/read-json'
import { managedPublishingPlatforms } from '@/lib/publishing-config'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const platforms = new Set(['linkedin', 'x', 'instagram', 'facebook'])

async function currentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function bodyOf(req: NextRequest): Promise<Record<string, unknown> | NextResponse> {
  try {
    const body = await readJsonBody(req, 8_000)
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
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await createAdminClient().from('publish_queue')
    .select('id,platform,content,scheduled_at,status,delivery_mode,published_at,external_post_id,last_error,created_at')
    .eq('user_id', user.id)
    .order('scheduled_at', { ascending: true })
    .limit(100)
  if (error) return NextResponse.json({ error: 'Could not load calendar' }, { status: 503 })
  const { data: connected } = await createAdminClient().from('publishing_connections')
    .select('platform').eq('user_id', user.id).eq('enabled', true)
  const allowedPlatforms = process.env.MAKE_PUBLISH_WEBHOOK_URL && process.env.MAKE_WEBHOOK_API_KEY
    ? managedPublishingPlatforms()
    : new Set<string>()
  return NextResponse.json({
    items: data,
    connectedPlatforms: (connected ?? [])
      .map((item) => item.platform)
      .filter((platform) => allowedPlatforms.has(platform)),
  })
}

export async function POST(req: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await bodyOf(req)
  if (body instanceof NextResponse) return body
  const platform = body.platform
  const deliveryMode = body.deliveryMode ?? 'manual'
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const scheduledAt = typeof body.scheduledAt === 'string' ? Date.parse(body.scheduledAt) : NaN
  if (typeof platform !== 'string' || !platforms.has(platform) ||
      content.length < 10 || content.length > 5_000 ||
      !Number.isFinite(scheduledAt) ||
      scheduledAt < Date.now() - 300_000 ||
      scheduledAt > Date.now() + 366 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Choose a platform, date within one year, and 10–5,000 characters of content.' }, { status: 400 })
  }
  if (deliveryMode !== 'manual' && deliveryMode !== 'managed') {
    return NextResponse.json({ error: 'Invalid delivery mode' }, { status: 400 })
  }
  if (deliveryMode === 'managed' && platform === 'instagram' && content.length > 2_200) {
    return NextResponse.json({ error: 'Instagram captions must be at most 2,200 characters.' }, { status: 400 })
  }
  const thread = body.thread
  if (deliveryMode === 'managed' && platform === 'x' &&
      (!Array.isArray(thread) || thread.length < 3 || thread.length > 8 ||
       thread.some((post) => typeof post !== 'string' || !post.trim() || post.length > 280))) {
    return NextResponse.json({ error: 'X publishing requires a valid thread of 3–8 posts.' }, { status: 400 })
  }
  const mediaUrl = typeof body.mediaUrl === 'string' ? body.mediaUrl.trim() : ''
  if (deliveryMode === 'managed' && platform === 'instagram') {
    let url: URL
    try { url = new URL(mediaUrl) } catch {
      return NextResponse.json({ error: 'Instagram publishing needs a public JPEG URL.' }, { status: 400 })
    }
    if (url.protocol !== 'https:' ||
        url.hostname !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname ||
        !url.pathname.startsWith(`/storage/v1/object/public/publishing/${user.id}/`) ||
        !url.pathname.endsWith('.jpg') || url.search || url.hash) {
      return NextResponse.json({ error: 'Use a JPEG from the Orbact publishing media bucket.' }, { status: 400 })
    }
  }
  const generationId = body.generationId
  if (generationId !== null && generationId !== undefined &&
      (typeof generationId !== 'string' || !UUID.test(generationId))) {
    return NextResponse.json({ error: 'Invalid draft ID' }, { status: 400 })
  }
  const admin = createAdminClient()
  if (deliveryMode === 'managed') {
    if (!managedPublishingPlatforms().has(platform as 'linkedin' | 'x' | 'instagram' | 'facebook') ||
        !process.env.MAKE_PUBLISH_WEBHOOK_URL || !process.env.MAKE_WEBHOOK_API_KEY) {
      return NextResponse.json({ error: 'Managed publishing is not configured.' }, { status: 503 })
    }
    const { data: connection } = await admin.from('publishing_connections')
      .select('id').eq('user_id', user.id).eq('platform', platform).eq('enabled', true).single()
    if (!connection) return NextResponse.json({ error: 'This platform is not connected for managed publishing.' }, { status: 403 })
  }
  if (generationId) {
    const { data: generation, error } = await admin.from('generations')
      .select('id').eq('id', generationId).eq('user_id', user.id).eq('status', 'complete').single()
    if (error || !generation) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }
  const { data, error } = await admin.from('publish_queue')
    .insert({
      user_id: user.id,
      generation_id: generationId || null,
      platform,
      content,
      thread: deliveryMode === 'managed' && platform === 'x' ? thread : null,
      media_url: deliveryMode === 'managed' && platform === 'instagram' ? mediaUrl : null,
      scheduled_at: new Date(scheduledAt).toISOString(),
      delivery_mode: deliveryMode,
      status: deliveryMode === 'managed' ? 'queued' : 'planned',
      approved_at: deliveryMode === 'managed' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Could not add to calendar' }, { status: 503 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await bodyOf(req)
  if (body instanceof NextResponse) return body
  if (typeof body.id !== 'string' || !UUID.test(body.id) || body.status !== 'published') {
    return NextResponse.json({ error: 'Invalid calendar update' }, { status: 400 })
  }
  const { data, error } = await createAdminClient().from('publish_queue')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', body.id).eq('user_id', user.id).eq('status', 'planned').eq('delivery_mode', 'manual')
    .select('id').single()
  if (error || !data) return NextResponse.json({ error: 'Calendar item not found' }, { status: 404 })
  return NextResponse.json({ updated: true })
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await bodyOf(req)
  if (body instanceof NextResponse) return body
  if (typeof body.id !== 'string' || !UUID.test(body.id)) {
    return NextResponse.json({ error: 'Invalid calendar item ID' }, { status: 400 })
  }
  const { data, error } = await createAdminClient().from('publish_queue')
    .delete().eq('id', body.id).eq('user_id', user.id)
    .in('status', ['planned', 'queued']).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'Calendar item not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
