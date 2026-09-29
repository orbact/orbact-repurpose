import { createHmac } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 60

type Job = {
  id: string
  user_id: string
  platform: string
  content: string
  thread: string[] | null
  media_url: string | null
  scheduled_at: string
}

function publisherUrl(): URL {
  const url = new URL(process.env.N8N_PUBLISH_WEBHOOK_URL!)
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Publishing webhook must use HTTPS without embedded credentials')
  }
  return url
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== 'Bearer ' + secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (process.env.ENABLE_MANAGED_PUBLISHING !== 'true') {
    return NextResponse.json({ disabled: true })
  }
  if (!process.env.N8N_PUBLISH_WEBHOOK_URL || !process.env.N8N_PUBLISH_SIGNING_SECRET) {
    return NextResponse.json({ error: 'Publisher not configured' }, { status: 503 })
  }
  let url: URL
  try { url = publisherUrl() } catch {
    return NextResponse.json({ error: 'Invalid publisher URL' }, { status: 503 })
  }

  const admin = createAdminClient()
  // An uncertain outcome is never retried automatically; a person must reconcile it.
  const stale = new Date(Date.now() - 10 * 60_000).toISOString()
  const { error: staleError } = await admin.from('publish_queue')
    .update({ status: 'needs_review', last_error: 'Delivery timed out; check the platform before retrying.' })
    .eq('status', 'publishing').lt('dispatched_at', stale)
  if (staleError) return NextResponse.json({ error: 'Could not reconcile publishing jobs' }, { status: 503 })

  const { data, error: claimError } = await admin.rpc('claim_due_posts', { p_limit: 2 })
  if (claimError) return NextResponse.json({ error: 'Could not claim publishing jobs' }, { status: 503 })
  const jobs = (data ?? []) as Job[]
  const results: { id: string; status: string }[] = []

  for (const job of jobs) {
    try {
      const { data: connection, error: connectionError } = await admin.from('publishing_connections')
        .select('external_account_id').eq('user_id', job.user_id)
        .eq('platform', job.platform).eq('enabled', true).single()
      if (connectionError || !connection) {
        await admin.from('publish_queue').update({
          status: 'failed', last_error: 'Publishing account connection is unavailable.',
        }).eq('id', job.id).eq('status', 'publishing')
        results.push({ id: job.id, status: 'failed' })
        continue
      }

      const payload = JSON.stringify({
        jobId: job.id,
        userId: job.user_id,
        platform: job.platform,
        accountId: connection.external_account_id,
        content: job.content,
        thread: job.thread,
        mediaUrl: job.media_url,
        scheduledAt: job.scheduled_at,
      })
      const signature = createHmac('sha256', process.env.N8N_PUBLISH_SIGNING_SECRET!)
        .update(payload).digest('hex')
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Orbact-Signature': signature,
          'X-Orbact-Job-Id': job.id,
        },
        body: payload,
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
      })
      if (!response.ok) throw new Error('Publishing workflow returned HTTP ' + response.status)
      const result = await response.json() as {
        status?: string
        externalId?: string
        error?: string
      }
      if (result.status === 'failed') {
        const { error } = await admin.from('publish_queue').update({
          status: 'failed', last_error: (result.error || 'Platform rejected the post').slice(0, 300),
        }).eq('id', job.id).eq('status', 'publishing')
        if (error) throw error
        results.push({ id: job.id, status: 'failed' })
        continue
      }
      if (result.status !== 'published') throw new Error('Publishing workflow returned an uncertain result')
      const { error } = await admin.from('publish_queue').update({
        status: 'published',
        published_at: new Date().toISOString(),
        external_post_id: typeof result.externalId === 'string' ? result.externalId.slice(0, 200) : null,
        last_error: null,
      }).eq('id', job.id).eq('status', 'publishing')
      if (error) throw error
      results.push({ id: job.id, status: 'published' })
    } catch (error) {
      console.error('Managed publishing needs review', job.id, error)
      await admin.from('publish_queue').update({
        status: 'needs_review',
        last_error: 'Delivery outcome is uncertain. Check the platform before taking action.',
      }).eq('id', job.id).eq('status', 'publishing')
      results.push({ id: job.id, status: 'needs_review' })
    }
  }
  return NextResponse.json({ processed: results })
}
