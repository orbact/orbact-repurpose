import { createAdminClient } from '@/lib/supabase/admin'
import { parsePublisherResult, type PublishingPlatform } from '@/lib/publishing-config'

export type PublishingJob = {
  id: string
  user_id: string
  platform: string
  content: string
  thread: string[] | null
  media_url: string | null
  scheduled_at: string
}

type Admin = ReturnType<typeof createAdminClient>

export async function dispatchClaimedJob(
  admin: Admin,
  job: PublishingJob,
  allowedPlatforms: Set<PublishingPlatform>,
  url: URL,
  apiKey: string
): Promise<{ id: string; status: string }> {
  try {
    if (!allowedPlatforms.has(job.platform as PublishingPlatform)) {
      const { error } = await admin.from('publish_queue').update({
        status: 'failed', last_error: 'Managed publishing is disabled for this platform.',
      }).eq('id', job.id).eq('status', 'publishing')
      if (error) throw error
      return { id: job.id, status: 'failed' }
    }
    const { data: connection, error: connectionError } = await admin.from('publishing_connections')
      .select('external_account_id').eq('user_id', job.user_id)
      .eq('platform', job.platform).eq('enabled', true).single()
    if (connectionError || !connection) {
      const { error } = await admin.from('publish_queue').update({
        status: 'failed', last_error: 'Publishing account connection is unavailable.',
      }).eq('id', job.id).eq('status', 'publishing')
      if (error) throw error
      return { id: job.id, status: 'failed' }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-make-apikey': apiKey,
        'X-Orbact-Job-Id': job.id,
      },
      body: JSON.stringify({
        jobId: job.id,
        userId: job.user_id,
        platform: job.platform,
        accountId: connection.external_account_id,
        content: job.content,
        thread: job.thread,
        mediaUrl: job.media_url,
        scheduledAt: job.scheduled_at,
      }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error('Publishing workflow returned HTTP ' + response.status)
    const result = parsePublisherResult(await response.json())
    if (!result) throw new Error('Publishing workflow returned an incomplete result')
    if (result.status === 'failed') {
      const { error } = await admin.from('publish_queue').update({
        status: 'failed', last_error: result.error,
      }).eq('id', job.id).eq('status', 'publishing')
      if (error) throw error
      return { id: job.id, status: 'failed' }
    }
    const { error } = await admin.from('publish_queue').update({
      status: 'published',
      published_at: new Date().toISOString(),
      external_post_id: result.externalId,
      last_error: null,
    }).eq('id', job.id).eq('status', 'publishing')
    if (error) throw error
    return { id: job.id, status: 'published' }
  } catch (error) {
    console.error('Managed publishing needs review', job.id, error)
    await admin.from('publish_queue').update({
      status: 'needs_review',
      last_error: 'Delivery outcome is uncertain. Check the platform before taking action.',
    }).eq('id', job.id).eq('status', 'publishing')
    return { id: job.id, status: 'needs_review' }
  }
}
