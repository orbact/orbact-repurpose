import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { makeWebhookUrl, managedPublishingPlatforms } from '@/lib/publishing-config'
import { dispatchClaimedJob, type PublishingJob } from '@/lib/publishing/dispatch'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== 'Bearer ' + secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allowedPlatforms = managedPublishingPlatforms()
  if (allowedPlatforms.size === 0) return NextResponse.json({ disabled: true })
  if (!process.env.MAKE_PUBLISH_WEBHOOK_URL || !process.env.MAKE_WEBHOOK_API_KEY) {
    return NextResponse.json({ error: 'Publisher not configured' }, { status: 503 })
  }
  let url: URL
  try { url = makeWebhookUrl(process.env.MAKE_PUBLISH_WEBHOOK_URL) } catch {
    return NextResponse.json({ error: 'Invalid publisher URL' }, { status: 503 })
  }

  const admin = createAdminClient()
  const stale = new Date(Date.now() - 10 * 60_000).toISOString()
  const { error: staleError } = await admin.from('publish_queue')
    .update({ status: 'needs_review', last_error: 'Delivery timed out; check the platform before retrying.' })
    .eq('status', 'publishing').lt('dispatched_at', stale)
  if (staleError) return NextResponse.json({ error: 'Could not reconcile publishing jobs' }, { status: 503 })

  const { data, error: claimError } = await admin.rpc('claim_due_posts', { p_limit: 4 })
  if (claimError) return NextResponse.json({ error: 'Could not claim publishing jobs' }, { status: 503 })
  const jobs = (data ?? []) as PublishingJob[]
  const results = await Promise.all(jobs.map((job) =>
    dispatchClaimedJob(admin, job, allowedPlatforms, url, process.env.MAKE_WEBHOOK_API_KEY!)
  ))
  return NextResponse.json({ processed: results })
}
