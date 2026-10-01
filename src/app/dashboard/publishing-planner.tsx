'use client'

import { useEffect, useState } from 'react'
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
  outputs, generationId,
}: {
  outputs: GeneratedContent | null
  generationId: string | null
}) {
  const [platform, setPlatform] = useState<Platform>('linkedin')
  const [scheduledAt, setScheduledAt] = useState('')
  const [content, setContent] = useState('')
  const [deliveryMode, setDeliveryMode] = useState<'manual' | 'managed'>('manual')
  const [mediaUrl, setMediaUrl] = useState('')
  const [connected, setConnected] = useState<Platform[]>([])
  const [uploading, setUploading] = useState(false)
  const [items, setItems] = useState<CalendarItem[]>([])
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
    setDeliveryMode('manual')
    setMediaUrl('')
    if (outputs) setContent(contentFor(next, outputs))
  }

  function useCurrentDraft() {
    if (outputs) setContent(contentFor(platform, outputs))
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
    const date = new Date(scheduledAt)
    if (!Number.isFinite(date.valueOf())) {
      setError('Choose a valid date and time.')
      return
    }
    if (deliveryMode === 'managed' && platform === 'instagram' && !mediaUrl) {
      setError('Upload a JPEG before scheduling Instagram publishing.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform, content, scheduledAt: date.toISOString(), generationId,
          deliveryMode, mediaUrl,
          thread: platform === 'x' ? content.split(/\n\s*\n/).map((post) => post.trim()).filter(Boolean) : null,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not add to calendar')
      setNotice(deliveryMode === 'managed'
        ? 'Approved and queued. Review its publishing status here.'
        : 'Added to your calendar. Check this page on the planned date, then copy and publish it manually.')
      setRefreshKey((key) => key + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add this plan.')
    } finally {
      setBusy(false)
    }
  }

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
            <input id="plan-date" type="datetime-local" required value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="input-field" />
          </div>
          <div>
            <label htmlFor="delivery-mode" className="block text-sm text-muted mb-2">Delivery</label>
            <select id="delivery-mode" value={deliveryMode} onChange={(event) => setDeliveryMode(event.target.value as 'manual' | 'managed')} className="input-field">
              <option value="manual">Manual plan</option>
              {connected.includes(platform) && <option value="managed">Publish automatically</option>}
            </select>
          </div>
          <button type="button" onClick={useCurrentDraft} className="btn-secondary text-sm">Use current draft</button>
          <div className="md:col-span-2 xl:col-span-4">
            <label htmlFor="plan-content" className="block text-sm text-muted mb-2">Post copy {platform === 'x' ? '(separate thread posts with a blank line)' : ''}</label>
            <textarea id="plan-content" value={content} onChange={(event) => setContent(event.target.value)} minLength={10} maxLength={5000} rows={5} required className="input-field resize-y" placeholder="Use current draft, then review the copy" />
          </div>
          {deliveryMode === 'managed' && platform === 'instagram' && (
            <div className="md:col-span-2 xl:col-span-4 rounded-xl border border-border p-4">
              <label htmlFor="plan-image" className="block text-sm mb-2">Instagram JPEG (under 4 MB)</label>
              <input id="plan-image" type="file" accept="image/jpeg" onChange={(event) => uploadImage(event.target.files?.[0])} className="text-sm text-muted" />
              <p className="text-xs text-muted mt-2">The image is stored in a public bucket so Instagram can fetch it. Avoid private or sensitive images.</p>
              {uploading && <p role="status" className="text-xs text-violet-300 mt-2">Uploading image...</p>}
              {mediaUrl && <p role="status" className="text-xs text-success mt-2">Image ready for scheduling.</p>}
            </div>
          )}
          {deliveryMode === 'managed' && <p className="text-xs text-warning md:col-span-2 xl:col-span-4">Scheduling approves this exact copy and media for automatic delivery. Check it carefully before submitting.</p>}
          <button type="submit" disabled={busy || uploading} className="btn-primary text-sm justify-self-start">{busy ? 'Scheduling...' : deliveryMode === 'managed' ? 'Approve & schedule' : 'Add reminder'}</button>
          {platform === 'instagram' && deliveryMode === 'manual' && <p className="text-xs text-warning md:col-span-2 xl:col-span-4">Instagram needs an image. Download a carousel PNG or prepare another visual before publishing.</p>}
        </form>
      )}
      {error && <p role="alert" className="text-danger text-sm mt-4">{error}</p>}
      {notice && <p role="status" className="text-success text-sm mt-4">{notice}</p>}
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
