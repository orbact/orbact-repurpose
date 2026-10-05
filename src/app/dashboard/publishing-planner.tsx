'use client'

import { useEffect, useRef, useState } from 'react'
import type { GeneratedContent } from '@/lib/ai/content-schema'

type Platform = 'linkedin' | 'x' | 'instagram' | 'facebook'
type CalendarItem = {
  id: string
  platform: Platform
  content: string
  scheduled_at: string
  status: 'planned' | 'queued' | 'publishing' | 'published' | 'failed' | 'needs_review'
  delivery_mode: 'manual' | 'managed'
  last_error: string | null
  external_post_id: string | null
}

function contentFor(platform: Platform, outputs: GeneratedContent): string {
  if (platform === 'linkedin') return outputs.linkedin
  if (platform === 'x') return outputs.twitter_thread.join('\n\n')
  if (platform === 'instagram') return outputs.instagram_caption + '\n\n' + outputs.instagram_hashtags.map((tag) => '#' + tag).join(' ')
  return outputs.facebook_post || outputs.linkedin
}

export default function PublishingPlanner({
  outputs, generationId, preparedImage,
}: {
  outputs: GeneratedContent | null
  generationId: string | null
  preparedImage: File | null
}) {
  const [platform, setPlatform] = useState<Platform>('linkedin')
  const [scheduledAt, setScheduledAt] = useState('')
  const [content, setContent] = useState('')
  const [editedPosts, setEditedPosts] = useState<Partial<Record<Platform, string>>>({})
  const [deliveryMode, setDeliveryMode] = useState<'manual' | 'managed'>('manual')
  const [postAll, setPostAll] = useState(false)
  const [publishWhen, setPublishWhen] = useState<'now' | 'later'>('later')
  const requestIds = useRef<Partial<Record<Platform, string>>>({})
  const [attemptFinished, setAttemptFinished] = useState(false)
  const [mediaUrl, setMediaUrl] = useState('')
  const [connected, setConnected] = useState<Platform[]>([])
  const [uploading, setUploading] = useState(false)
  const [items, setItems] = useState<CalendarItem[]>([])
  const [reviewIds, setReviewIds] = useState<Record<string, string>>({})
  const [reviewedNoPost, setReviewedNoPost] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let live = true
    fetch('/api/calendar')
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Could not load calendar')
        if (live) {
          setItems(body.items)
          setConnected(body.connectedPlatforms || [])
        }
      })
      .catch((cause) => { if (live) setError(cause.message) })
    return () => { live = false }
  }, [refreshKey])

  function selectPlatform(next: Platform) {
    setPlatform(next)
    if (deliveryMode === 'managed' && !connected.includes(next)) {
      setDeliveryMode('manual')
      setPostAll(false)
    }
    if (outputs) setContent(editedPosts[next] ?? contentFor(next, outputs))
  }

  function useCurrentDraft() {
    if (outputs) {
      const draft = contentFor(platform, outputs)
      setContent(draft)
      setEditedPosts((current) => ({ ...current, [platform]: draft }))
    }
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return
    setError(null)
    setMediaUrl('')
    if (file.type !== 'image/jpeg' || file.size > 4_000_000) {
      setError('Choose a JPEG under 4 MB.')
      return
    }
    setUploading(true)
    try {
      const response = await fetch('/api/publishing-media', {
        method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: file,
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Upload failed')
      setMediaUrl(body.url)
      setNotice('Image uploaded. It is publicly accessible for Instagram publishing.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Image upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function plan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    const publishNow = deliveryMode === 'managed' && publishWhen === 'now'
    const date = publishNow ? new Date() : new Date(scheduledAt)
    if (!Number.isFinite(date.valueOf())) {
      setError('Choose a valid date and time.')
      return
    }
    const targets = deliveryMode === 'managed' && postAll ? connected.filter((item) => item !== 'x') : [platform]
    if (targets.length === 0) {
      setError('No connected platform is available for automatic publishing.')
      return
    }
    if (deliveryMode === 'managed' && targets.includes('instagram') && !mediaUrl) {
      setError('Upload a JPEG before scheduling Instagram publishing.')
      return
    }
    const requestKey = `orbact-publish-request:${generationId ?? 'draft'}`
    if (publishNow && Object.keys(requestIds.current).length === 0) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(requestKey) || '{}') as Partial<Record<Platform, string>>
        if (saved && typeof saved === 'object') requestIds.current = saved
      } catch { /* A fresh request ID will be used. */ }
    }
    const posts = targets.map((target) => {
      const copy = target === platform && content.trim()
        ? content : editedPosts[target] ?? (outputs ? contentFor(target, outputs) : '')
      return {
        ...(publishNow ? { id: requestIds.current[target] ??= crypto.randomUUID() } : {}),
        platform: target, content: copy,
        mediaUrl: target === 'instagram' ? mediaUrl : null,
        thread: target === 'x' ? copy.split(/\n\s*\n/).map((post) => post.trim()).filter(Boolean) : null,
      }
    })
    if (publishNow) sessionStorage.setItem(requestKey, JSON.stringify(requestIds.current))
    setBusy(true)
    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posts, scheduledAt: date.toISOString(), generationId, deliveryMode, publishNow,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not add to calendar')
      if (publishNow) {
        const results = body.items as Array<{ status: string }> | undefined
        const uncertain = results?.some((item) => item.status === 'needs_review' || item.status === 'publishing')
        const published = results?.filter((item) => item.status === 'published').length ?? 0
        const failed = results?.filter((item) => item.status === 'failed').length ?? 0
        const queued = results?.filter((item) => item.status === 'queued').length ?? 0
        setNotice(uncertain
          ? 'At least one delivery needs review. Check its platform and calendar status before taking another action.'
          : `Publishing result: ${published} published, ${failed} failed, ${queued} queued. Review each platform below.`)
        setAttemptFinished(true)
      } else {
        setNotice(deliveryMode === 'managed'
          ? `${posts.length} approved post${posts.length === 1 ? '' : 's'} queued. Review each publishing status here.`
          : 'Added to your calendar. Check this page on the planned date, then copy and publish it manually.')
      }
      setRefreshKey((key) => key + 1)
    } catch (cause) {
      setError(publishNow && cause instanceof TypeError
        ? 'The connection was interrupted. Refresh the calendar and check each platform before retrying this same request.'
        : cause instanceof Error ? cause.message : 'Could not add this plan.')
      if (publishNow) setRefreshKey((key) => key + 1)
    } finally {
      setBusy(false)
    }
  }

  function startNewPublish() {
    requestIds.current = {}
    sessionStorage.removeItem(`orbact-publish-request:${generationId ?? 'draft'}`)
    setAttemptFinished(false)
    setNotice(null)
  }

  const needsInstagramMedia = deliveryMode === 'managed' &&
    (platform === 'instagram' || (postAll && connected.includes('instagram')))

  async function changeItem(id: string, method: 'PATCH' | 'DELETE') {
    setError(null)
    try {
      const response = await fetch('/api/calendar', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(method === 'PATCH' ? { id, status: 'published' } : { id }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not update calendar')
      setRefreshKey((key) => key + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update calendar')
    }
  }

  async function resolveItem(id: string, resolution: 'published' | 'failed') {
    setError(null)
    setBusy(true)
    try {
      const response = await fetch('/api/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id, resolution, externalPostId: reviewIds[id] || '',
          confirmNoPost: reviewedNoPost[id] === true,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not resolve the post')
      setNotice(resolution === 'published' ? 'Confirmed platform post recorded.' : 'Confirmed no post was found; this job will not retry.')
      setRefreshKey((key) => key + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not resolve the post')
    } finally { setBusy(false) }
  }

  async function copyText(text: string, label: string) {
    setError(null)
    try {
      await navigator.clipboard.writeText(text)
      setNotice(`${label} copied. Paste it into the platform when you are ready.`)
    } catch {
      setError('Could not copy automatically. Select the text and copy it manually.')
    }
  }

  return (
    <section id="calendar" className="glass-card p-6 md:p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">02 / Plan</p>
      <h2 className="text-2xl font-semibold tracking-tight">Content calendar</h2>
      <p className="text-sm text-muted mt-2">Plan and copy posts for LinkedIn, X, Instagram, and Facebook at no cost. Automatic delivery appears only for approved connected accounts.</p>
      {outputs && (
        <form onSubmit={plan} className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 items-end mt-7">
          <div>
            <label htmlFor="plan-platform" className="block text-sm text-muted mb-2">Platform</label>
            <select id="plan-platform" value={platform} onChange={(event) => selectPlatform(event.target.value as Platform)} className="input-field">
              <option value="linkedin">LinkedIn</option>
              <option value="x">X</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook Page</option>
            </select>
          </div>
          <div>
            <label htmlFor="plan-date" className="block text-sm text-muted mb-2">Local date and time</label>
            <input id="plan-date" type="datetime-local" required={deliveryMode === 'manual' || publishWhen === 'later'} disabled={deliveryMode === 'managed' && publishWhen === 'now'} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="input-field" />
          </div>
          <div>
            <label htmlFor="delivery-mode" className="block text-sm text-muted mb-2">Delivery</label>
            <select id="delivery-mode" value={deliveryMode} onChange={(event) => {
              const next = event.target.value as 'manual' | 'managed'
              setDeliveryMode(next)
              if (next === 'manual') setPostAll(false)
            }} className="input-field">
              <option value="manual">Manual plan</option>
              {connected.includes(platform) && <option value="managed">Publish automatically</option>}
            </select>
          </div>
          <button type="button" onClick={useCurrentDraft} className="btn-secondary text-sm">Use current draft</button>
          {deliveryMode === 'managed' && <fieldset className="md:col-span-2 xl:col-span-4 flex flex-wrap gap-5 rounded-xl border border-border p-4 text-sm">
            <legend className="px-1 text-muted">When to publish</legend>
            <label className="flex items-center gap-2"><input type="radio" name="publish-when" checked={publishWhen === 'now'} onChange={() => setPublishWhen('now')} />Publish now</label>
            <label className="flex items-center gap-2"><input type="radio" name="publish-when" checked={publishWhen === 'later'} onChange={() => setPublishWhen('later')} />Schedule for later</label>
          </fieldset>}
          <div className="md:col-span-2 xl:col-span-4">
            <label htmlFor="plan-content" className="block text-sm text-muted mb-2">Post copy {platform === 'x' ? '(separate thread posts with a blank line)' : ''}</label>
            <textarea id="plan-content" value={content} onChange={(event) => {
              setContent(event.target.value)
              setEditedPosts((current) => ({ ...current, [platform]: event.target.value }))
            }} minLength={10} maxLength={5000} rows={5} required={!postAll} className="input-field resize-y" placeholder="Use current draft, then review the copy" />
          </div>
          {deliveryMode === 'managed' && connected.filter((item) => item !== 'x').length > 1 && (
            <div className="md:col-span-2 xl:col-span-4 rounded-xl border border-border p-4">
              <label className="flex items-center gap-3 text-sm font-medium">
                <input type="checkbox" checked={postAll} onChange={(event) => setPostAll(event.target.checked)} />
                Publish all connected Orbact platforms
              </label>
              <p className="text-xs text-muted mt-2">Selected: {connected.filter((item) => item !== 'x').join(', ')}. X remains manual. The current platform copy is editable above; switch platforms to review each draft.</p>
              {postAll && outputs && <div className="grid md:grid-cols-3 gap-3 mt-4">
                {connected.filter((item) => item !== 'x').map((target) => <div key={target} className="rounded-lg border border-border bg-white/[0.025] p-3">
                  <p className="text-xs uppercase tracking-wider text-violet-300">{target === 'facebook' ? 'Facebook Page' : target}</p>
                  <p className="text-xs text-muted mt-2 whitespace-pre-wrap max-h-48 overflow-auto">{target === platform && content.trim() ? content : editedPosts[target] ?? contentFor(target, outputs)}</p>
                </div>)}
              </div>}
            </div>
          )}
          {needsInstagramMedia && (
            <div className="md:col-span-2 xl:col-span-4 rounded-xl border border-border p-4">
              <label htmlFor="plan-image" className="block text-sm mb-2">Instagram JPEG (under 4 MB)</label>
              <input id="plan-image" type="file" accept="image/jpeg" onChange={(event) => uploadImage(event.target.files?.[0])} className="text-sm text-muted" />
              {preparedImage && <button type="button" onClick={() => void uploadImage(preparedImage)} disabled={uploading} className="btn-secondary text-xs mt-3">Attach finished Image Studio design</button>}
              <p className="text-xs text-muted mt-2">The image is stored in a public bucket so Instagram can fetch it. Avoid private or sensitive images.</p>
              {uploading && <p role="status" className="text-xs text-violet-300 mt-2">Uploading image...</p>}
              {mediaUrl && <p role="status" className="text-xs text-success mt-2">Image ready for scheduling.</p>}
            </div>
          )}
          {deliveryMode === 'managed' && <p className="text-xs text-warning md:col-span-2 xl:col-span-4">Your click approves the exact copy and media for every selected platform. Review all previews before publishing. Scheduled posts on this free prototype are checked once daily around 12:00–13:00 UTC and may wait until the next day.</p>}
          <button type="submit" disabled={busy || uploading || (publishWhen === 'now' && attemptFinished)} className="btn-primary text-sm justify-self-start">{busy ? 'Processing...' : deliveryMode === 'managed' ? publishWhen === 'now' ? postAll ? 'Approve & publish all now' : 'Approve & publish now' : postAll ? 'Approve & schedule all' : 'Approve & schedule' : 'Add reminder'}</button>
          {attemptFinished && <button type="button" onClick={startNewPublish} className="btn-secondary text-sm justify-self-start">Start a new publishing request</button>}
          {platform === 'instagram' && deliveryMode === 'manual' && <p className="text-xs text-warning md:col-span-2 xl:col-span-4">Instagram needs an image. Download a carousel PNG or prepare another visual before publishing.</p>}
        </form>
      )}
      {error && <p role="alert" className="text-danger text-sm mt-4">{error}</p>}
      {notice && <p role="status" className="text-success text-sm mt-4">{notice}</p>}
      {items.some((item) => item.status === 'needs_review') &&
        <p role="alert" className="text-sm text-warning mt-5 rounded-xl border border-warning/30 bg-warning/10 p-4">A delivery needs review. Check the actual social account and Make receipt before resolving it. Do not create another post until its outcome is known.</p>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mt-7">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-white/[0.025] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium capitalize">{item.platform === 'x' ? 'X' : item.platform}</span>
              <span className={'text-xs capitalize ' + (item.status === 'published' ? 'text-success' : item.status === 'failed' || item.status === 'needs_review' ? 'text-danger' : 'text-violet-300')}>{item.status.replace('_', ' ')}</span>
            </div>
            <p className="text-xs text-muted mt-2">{new Date(item.scheduled_at).toLocaleString()} · {item.delivery_mode === 'managed' ? 'Automatic' : 'Manual'}</p>
            <p className="text-sm text-muted mt-3 line-clamp-3 whitespace-pre-wrap">{item.content}</p>
            {item.last_error && <p className="text-xs text-warning mt-3">{item.last_error}</p>}
            {item.external_post_id && <p className="text-xs text-muted mt-2">Platform ID: {item.external_post_id}</p>}
            {item.status === 'needs_review' && <div className="mt-4 rounded-lg border border-warning/30 p-3 space-y-3">
              <p className="text-xs text-warning">Verify this job on the platform before choosing an outcome.</p>
              <label className="block text-xs text-muted">Confirmed platform post ID
                <input value={reviewIds[item.id] || ''} maxLength={200} onChange={(event) => setReviewIds((current) => ({ ...current, [item.id]: event.target.value }))} className="input-field mt-1" />
              </label>
              <button type="button" disabled={busy || !reviewIds[item.id]?.trim()} onClick={() => void resolveItem(item.id, 'published')} className="btn-secondary text-xs">Confirm published</button>
              <label className="flex items-start gap-2 text-xs text-muted">
                <input type="checkbox" checked={reviewedNoPost[item.id] || false} onChange={(event) => setReviewedNoPost((current) => ({ ...current, [item.id]: event.target.checked }))} />
                I checked the platform and Make receipt; no post exists.
              </label>
              <button type="button" disabled={busy || !reviewedNoPost[item.id]} onClick={() => void resolveItem(item.id, 'failed')} className="btn-secondary text-xs">Mark no post found</button>
            </div>}
            <div className="flex flex-wrap gap-4 mt-4">
              <button type="button" className="text-xs text-violet-300 hover:underline" onClick={() => copyText(item.content, 'Post copy')}>Copy all</button>
              {item.delivery_mode === 'manual' && item.platform === 'x' &&
                item.content.split(/\n\s*\n/).filter(Boolean).length > 1 &&
                item.content.split(/\n\s*\n/).filter(Boolean).map((post, index) => (
                  <button key={index} type="button" className="text-xs text-violet-300 hover:underline" onClick={() => copyText(post.trim(), `X post ${index + 1}`)}>Copy X post {index + 1}</button>
                ))}
              {item.status === 'planned' && <button type="button" className="text-xs text-muted hover:text-white" onClick={() => changeItem(item.id, 'PATCH')}>Mark published</button>}
              {(item.status === 'planned' || item.status === 'queued') && <button type="button" className="text-xs text-muted hover:text-danger" onClick={() => changeItem(item.id, 'DELETE')}>Remove</button>}
            </div>
          </div>
        ))}
      </div>
      {items.length === 0 && <p className="text-sm text-muted mt-6">No planned posts yet. Generate a draft, then add it here.</p>}
    </section>
  )
}
