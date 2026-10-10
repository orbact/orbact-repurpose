import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readJsonBody, RequestBodyError } from '@/lib/http/read-json'
import { managedPublishingPlatforms } from '@/lib/publishing-config'
import { makeWebhookUrl } from '@/lib/publishing-config'
import { dispatchClaimedJob, type PublishingJob } from '@/lib/publishing/dispatch'

export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const platforms = new Set(['linkedin', 'x', 'instagram', 'facebook'])

async function currentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function bodyOf(req: NextRequest): Promise<Record<string, unknown> | NextResponse> {
  try {
    const body = await readJsonBody(req, 24_000)
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
  const deliveryMode = body.deliveryMode ?? 'manual'
  const publishNow = body.publishNow === true
  if (body.publishNow !== undefined && typeof body.publishNow !== 'boolean') {
    return NextResponse.json({ error: 'Invalid publishing action.' }, { status: 400 })
  }
  if (publishNow && deliveryMode !== 'managed') {
    return NextResponse.json({ error: 'Immediate publishing requires a connected platform.' }, { status: 400 })
  }
  const scheduledAt = publishNow ? Date.now() : typeof body.scheduledAt === 'string' ? Date.parse(body.scheduledAt) : NaN
  if (!Number.isFinite(scheduledAt) ||
      scheduledAt < Date.now() - 300_000 ||
      scheduledAt > Date.now() + 366 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Choose a date within one year.' }, { status: 400 })
  }
  if (deliveryMode !== 'manual' && deliveryMode !== 'managed') {
    return NextResponse.json({ error: 'Invalid delivery mode' }, { status: 400 })
  }
  const posts = body.posts === undefined ? [body] : body.posts
  if (!Array.isArray(posts) || posts.length < 1 || posts.length > 4 ||
      posts.some((post) => !post || typeof post !== 'object' || Array.isArray(post))) {
    return NextResponse.json({ error: 'Choose one to four platform posts.' }, { status: 400 })
  }
  const selected = posts as Record<string, unknown>[]
  const selectedPlatforms = selected.map((post) => post.platform)
  if (selectedPlatforms.some((platform) => typeof platform !== 'string' || !platforms.has(platform)) ||
      new Set(selectedPlatforms).size !== selectedPlatforms.length) {
    return NextResponse.json({ error: 'Choose each supported platform only once.' }, { status: 400 })
  }
  if (publishNow && selected.some((post) => typeof post.id !== 'string' || !UUID.test(post.id))) {
    return NextResponse.json({ error: 'Publishing request IDs are missing.' }, { status: 400 })
  }
  const generationId = body.generationId
  if (generationId !== null && generationId !== undefined &&
      (typeof generationId !== 'string' || !UUID.test(generationId))) {
    return NextResponse.json({ error: 'Invalid draft ID' }, { status: 400 })
  }
  const admin = createAdminClient()
  let publisherUrl: URL | null = null
  if (deliveryMode === 'managed') {
    const allowed = managedPublishingPlatforms()
    if (!process.env.MAKE_PUBLISH_WEBHOOK_URL || !process.env.MAKE_WEBHOOK_API_KEY ||
        selectedPlatforms.some((platform) => !allowed.has(platform as 'linkedin' | 'x' | 'instagram' | 'facebook'))) {
      return NextResponse.json({ error: 'Managed publishing is not configured.' }, { status: 503 })
    }
    const { data: connections, error } = await admin.from('publishing_connections')
      .select('platform').eq('user_id', user.id).in('platform', selectedPlatforms as string[]).eq('enabled', true)
    if (error || connections?.length !== selected.length) {
      return NextResponse.json({ error: 'One or more selected platforms are not connected.' }, { status: 403 })
    }
    if (publishNow) {
      try { publisherUrl = makeWebhookUrl(process.env.MAKE_PUBLISH_WEBHOOK_URL!) } catch {
        return NextResponse.json({ error: 'Publishing webhook is not configured correctly.' }, { status: 503 })
      }
    }
  }
  if (generationId) {
    const { data: generation, error } = await admin.from('generations')
      .select('id').eq('id', generationId).eq('user_id', user.id).eq('status', 'complete').single()
    if (error || !generation) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }
  const rows = []
  for (const post of selected) {
    const platform = post.platform as string
    const content = typeof post.content === 'string' ? post.content.trim() : ''
    if (content.length < 10 || content.length > 5_000 ||
        (deliveryMode === 'managed' && platform === 'instagram' && content.length > 2_200)) {
      return NextResponse.json({ error: `${platform} copy is missing or too long.` }, { status: 400 })
    }
    const thread = post.thread
    if (deliveryMode === 'managed' && platform === 'x' &&
        (!Array.isArray(thread) || thread.length < 3 || thread.length > 8 ||
         thread.some((part) => typeof part !== 'string' || !part.trim() || part.length > 280))) {
      return NextResponse.json({ error: 'X publishing requires a valid thread of 3–8 posts.' }, { status: 400 })
    }
    const mediaUrl = typeof post.mediaUrl === 'string' ? post.mediaUrl.trim() : ''
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
    rows.push({
      ...(publishNow ? { id: post.id as string } : {}),
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
  }
  const { data, error } = await admin.from('publish_queue').insert(rows).select('id,platform')
  if (publishNow && error?.code === '23505') {
    const ids = selected.map((post) => post.id as string)
    const { data: existing, error: existingError } = await admin.from('publish_queue')
      .select('id,platform,content,media_url,delivery_mode,status,external_post_id,last_error')
      .eq('user_id', user.id).in('id', ids)
    if (!existingError && existing?.length === selected.length && existing.every((item) => {
      const original = selected.find((post) => post.id === item.id)
      return original && original.platform === item.platform &&
        typeof original.content === 'string' && original.content.trim() === item.content &&
        (original.mediaUrl || null) === item.media_url && item.delivery_mode === 'managed'
    })) {
      return NextResponse.json({ items: existing.map((item) => ({
        id: item.id, platform: item.platform, status: item.status,
        externalPostId: item.external_post_id, error: item.last_error,
      })) })
    }
    return NextResponse.json({ error: 'Publishing request IDs were already used. Check your calendar before retrying.' }, { status: 409 })
  }
  if (error || !data || data.length !== rows.length) {
    return NextResponse.json({ error: 'Could not add the selected posts to the calendar.' }, { status: 503 })
  }
  if (publishNow && publisherUrl) {
    const allowed = managedPublishingPlatforms()
    const results = []
    for (const inserted of data) {
      const { data: claimed, error: claimError } = await admin.from('publish_queue')
        .update({ status: 'publishing', dispatched_at: new Date().toISOString() })
        .eq('id', inserted.id).eq('user_id', user.id).eq('status', 'queued')
        .select('id,user_id,platform,content,thread,media_url,scheduled_at').single()
      if (claimError || !claimed) {
        results.push({ id: inserted.id, status: 'queued' })
        continue
      }
      results.push(await dispatchClaimedJob(admin, claimed as PublishingJob, allowed, publisherUrl, process.env.MAKE_WEBHOOK_API_KEY!))
    }
    return NextResponse.json({ items: results }, { status: 201 })
  }
  return NextResponse.json({ id: data[0].id, items: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await bodyOf(req)
  if (body instanceof NextResponse) return body
  if (typeof body.id === 'string' && UUID.test(body.id) && body.resolution) {
    if (body.resolution !== 'published' && body.resolution !== 'failed') {
      return NextResponse.json({ error: 'Choose a valid review outcome.' }, { status: 400 })
    }
    const externalPostId = typeof body.externalPostId === 'string' ? body.externalPostId.trim() : ''
    if (body.resolution === 'published' && (!externalPostId || externalPostId.length > 200)) {
      return NextResponse.json({ error: 'Enter the confirmed platform post ID.' }, { status: 400 })
    }
    if (body.resolution === 'failed' && body.confirmNoPost !== true) {
      return NextResponse.json({ error: 'Confirm that you checked the platform and no post exists.' }, { status: 400 })
    }
    const { data, error } = await createAdminClient().from('publish_queue')
      .update(body.resolution === 'published' ? {
        status: 'published', published_at: new Date().toISOString(),
        external_post_id: externalPostId, last_error: null,
      } : {
        status: 'failed', last_error: 'Reviewed: no platform post was found. A new post requires fresh approval.',
      })
      .eq('id', body.id).eq('user_id', user.id).eq('status', 'needs_review')
      .select('id').single()
    if (error || !data) return NextResponse.json({ error: 'Review item not found or already resolved.' }, { status: 404 })
    return NextResponse.json({ updated: true })
  }
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
