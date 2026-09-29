import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { makeWebhookUrl, managedPublishingPlatforms, parsePublisherResult } from '@/lib/publishing-config'

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

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== 'Bearer ' + secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allowedPlatforms = managedPublishingPlatforms()
  if (allowedPlatforms.size === 0) {
    return NextResponse.json({ disabled: true })
  }
  if (!process.env.MAKE_PUBLISH_WEBHOOK_URL || !process.env.MAKE_WEBHOOK_API_KEY) {
    return NextResponse.json({ error: 'Publisher not configured' }, { status: 503 })
  }
  let url: URL
  try { url = makeWebhookUrl(process.env.MAKE_PUBLISH_WEBHOOK_URL) } catch {
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
      if (!allowedPlatforms.has(job.platform as 'linkedin' | 'x' | 'instagram' | 'facebook')) {
        const { error } = await admin.from('publish_queue').update({
          status: 'failed', last_error: 'Managed publishing is disabled for this platform.',
        }).eq('id', job.id).eq('status', 'publishing')
        if (error) throw error
        results.push({ id: job.id, status: 'failed' })
        continue
      }
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
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-make-apikey': process.env.MAKE_WEBHOOK_API_KEY!,
          'X-Orbact-Job-Id': job.id,
        },
        body: payload,
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
      })
      if (!response.ok) throw new Error('Publishing workflow returned HTTP ' + response.status)
      const result = parsePublisherResult(await response.json())
      if (!result) throw new Error('Publishing workflow returned an incomplete result')
      if (result.status === 'failed') {
        const { error } = await admin.from('publish_queue').update({
          status: 'failed', last_error: result.error,
        }).eq('id', job.id).eq('status', 'publishing')
        if (error) throw error
        results.push({ id: job.id, status: 'failed' })
        continue
      }
      const { error } = await admin.from('publish_queue').update({
        status: 'published',
        published_at: new Date().toISOString(),
        external_post_id: result.externalId,
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
