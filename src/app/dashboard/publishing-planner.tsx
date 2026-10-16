'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { GeneratedContent } from '@/lib/ai/content-schema'

type Platform = 'linkedin' | 'x' | 'instagram' | 'facebook'
const PLATFORMS: Platform[] = ['linkedin', 'facebook', 'instagram', 'x']
const PLATFORM_LABELS: Record<Platform, string> = {
  linkedin: 'LinkedIn Page', facebook: 'Facebook Page', instagram: 'Instagram', x: 'X thread',
}
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
  outputs, generationId, postImageUrl,
}: {
  outputs: GeneratedContent | null
  generationId: string | null
  postImageUrl: string | null
}) {
  const [platform, setPlatform] = useState<Platform>('linkedin')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['linkedin'])
  const [scheduledAt, setScheduledAt] = useState('')
  const [editedPosts, setEditedPosts] = useState<Partial<Record<Platform, string>>>({})
  const [deliveryMode, setDeliveryMode] = useState<'manual' | 'managed'>('manual')
  const connectionsLoaded = useRef(false)
  const [publishWhen, setPublishWhen] = useState<'now' | 'later'>('later')
  const requestIds = useRef<Partial<Record<Platform, string>>>({})
  const [attemptFinished, setAttemptFinished] = useState(false)
  const [manualMedia, setManualMedia] = useState<{ url: string; designUrl: string | null } | null>(null)
  const mediaUrl = manualMedia?.designUrl === postImageUrl ? manualMedia.url : postImageUrl || ''
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
          if (!connectionsLoaded.current && body.connectedPlatforms?.length) {
            const first = PLATFORMS.find((item) => body.connectedPlatforms.includes(item))!
            setDeliveryMode('managed')
            setSelectedPlatforms([first])
            setPlatform(first)
          }
          connectionsLoaded.current = true
        }
      })
      .catch((cause) => { if (live) setError(cause.message) })
    return () => { live = false }
  }, [refreshKey])

  function selectPlatform(next: Platform) {
    setPlatform(next)
  }

  function togglePlatform(next: Platform) {
    if (deliveryMode === 'managed' && !connected.includes(next)) return
    const selected = selectedPlatforms.includes(next)
      ? selectedPlatforms.filter((item) => item !== next)
      : [...selectedPlatforms, next]
    setSelectedPlatforms(selected)
    if (!selected.includes(platform)) setPlatform(selected[0] ?? next)
    if (!selected) setPlatform(next)
  }

  function useCurrentDraft() {
    if (outputs) {
      const draft = contentFor(platform, outputs)
      setEditedPosts((current) => ({ ...current, [platform]: draft }))
    }
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return
    setError(null)
    setManualMedia(null)
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
      setManualMedia({ url: body.url, designUrl: postImageUrl })
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
    const targets = selectedPlatforms
    if (targets.length === 0) {
      setError('Select at least one platform.')
      return
    }
    if (deliveryMode === 'managed' && targets.some((target) => !connected.includes(target))) {
      setError('One or more selected platforms are not connected for automatic publishing.')
      return
    }
    const invalid = targets.find((target) => {
      const copy = (editedPosts[target] ?? (outputs ? contentFor(target, outputs) : '')).trim()
      if (target === 'x' && deliveryMode === 'managed') {
        const thread = copy.split(/\n\s*\n/).map((post) => post.trim()).filter(Boolean)
        return thread.length < 3 || thread.length > 8 || thread.some((post) => post.length > 280)
      }
      return copy.length < 10 || copy.length > (target === 'instagram' && deliveryMode === 'managed' ? 2200 : 5000)
    })
    if (invalid) {
      selectPlatform(invalid)
      setError(`Review the ${PLATFORM_LABELS[invalid]} copy before continuing.`)
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
      const copy = editedPosts[target] ?? (outputs ? contentFor(target, outputs) : '')
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

  const needsInstagramMedia = deliveryMode === 'managed' && selectedPlatforms.includes('instagram')
  const activeCopy = editedPosts[platform] ?? (outputs ? contentFor(platform, outputs) : '')

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
    <section id="calendar" className="glass-card overflow-hidden scroll-mt-24">
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_85%_10%,rgba(0,225,230,0.16),transparent_34%),linear-gradient(125deg,#11151b,#090b10)] p-6 md:p-8">
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300 mb-2">02 / Publish</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Orbact Display, sans-serif' }}>Publish on platforms</h2>
            <p className="text-sm text-muted mt-2 max-w-2xl">Choose your channels, review each version, then publish now or schedule. Nothing is sent until you approve it below.</p>
          </div>
          <span className="text-xs rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-cyan-100">{connected.length} automatic connection{connected.length === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div className="p-6 md:p-8">
      {outputs && (
        <form onSubmit={plan} className="space-y-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap rounded-xl border border-white/10 bg-black/30 p-1 gap-1" aria-label="Delivery method">
              <button type="button" aria-pressed={deliveryMode === 'managed'} disabled={!connected.length} onClick={() => {
                setDeliveryMode('managed')
                const available = selectedPlatforms.filter((item) => connected.includes(item))
                setSelectedPlatforms(available.length ? available : [connected[0]])
                if (!connected.includes(platform)) selectPlatform(available[0] ?? connected[0])
              }} className={'rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 ' + (deliveryMode === 'managed' ? 'bg-cyan-300 text-slate-950' : 'text-muted hover:text-white')}>Automatic publishing</button>
              <button type="button" aria-pressed={deliveryMode === 'manual'} onClick={() => setDeliveryMode('manual')} className={'rounded-lg px-4 py-2 text-sm font-medium transition-colors ' + (deliveryMode === 'manual' ? 'bg-cyan-300 text-slate-950' : 'text-muted hover:text-white')}>Manual plan</button>
            </div>
            {deliveryMode === 'managed' && connected.length > 1 && <button type="button" onClick={() => { setSelectedPlatforms(connected); selectPlatform(connected[0]) }} className="text-sm font-semibold text-cyan-300 hover:text-cyan-100">Select all connected →</button>}
          </div>

          <fieldset>
            <legend className="text-sm font-semibold mb-3">1. Select platforms</legend>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {PLATFORMS.map((target) => {
                const available = deliveryMode === 'manual' || connected.includes(target)
                const selected = selectedPlatforms.includes(target)
                return <button key={target} type="button" aria-pressed={selected} disabled={!available} onClick={() => togglePlatform(target)}
                  className={'min-h-24 rounded-2xl border p-4 text-left transition-colors disabled:opacity-45 disabled:cursor-not-allowed ' + (selected ? 'border-cyan-300/70 bg-cyan-300/10' : 'border-white/10 bg-white/[0.025] hover:border-white/30')}>
                  <span className="flex items-center justify-between gap-2 text-sm font-semibold"><span>{PLATFORM_LABELS[target]}</span><span aria-hidden="true" className={selected ? 'text-cyan-300' : 'text-muted'}>{selected ? '●' : '○'}</span></span>
                  <span className="block mt-3 text-xs text-muted">{connected.includes(target) ? 'Connected to Orbact' : target === 'x' ? 'Manual posting' : 'Manual only'}</span>
                </button>
              })}
            </div>
          </fieldset>

          <div>
            <h3 className="text-sm font-semibold mb-3">2. Review and edit each post</h3>
            <div className="grid lg:grid-cols-[230px_minmax(0,1fr)] gap-4">
              <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto" aria-label="Selected draft previews">
                {selectedPlatforms.map((target) => <button key={target} type="button" onClick={() => selectPlatform(target)} aria-pressed={platform === target}
                  className={'min-w-40 rounded-xl border p-3 text-left transition-colors ' + (platform === target ? 'border-cyan-300/65 bg-cyan-300/10' : 'border-white/10 bg-white/[0.025] hover:border-white/30')}>
                  <span className="text-sm font-semibold">{PLATFORM_LABELS[target]}</span>
                  <span className="block text-xs text-muted mt-1 line-clamp-2">{editedPosts[target] ?? contentFor(target, outputs)}</span>
                  <span className="block text-xs text-cyan-300 mt-2">{platform === target ? 'Editing now' : 'Review copy →'}</span>
                </button>)}
                {selectedPlatforms.length === 0 && <p className="text-xs text-muted">Choose a platform above to review its draft.</p>}
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <label htmlFor="plan-content" className="text-sm font-semibold">{PLATFORM_LABELS[platform]} copy</label>
                  <button type="button" onClick={useCurrentDraft} className="text-xs text-cyan-300 hover:text-cyan-100">Reset to generated draft</button>
                </div>
                <textarea id="plan-content" value={activeCopy} onChange={(event) => setEditedPosts((current) => ({ ...current, [platform]: event.target.value }))}
                  minLength={10} maxLength={platform === 'instagram' ? 2200 : 5000} rows={8} required={selectedPlatforms.includes(platform)} className="input-field resize-y leading-relaxed" />
                <p className="text-xs text-muted mt-2">{activeCopy.length} characters{platform === 'x' ? ' · Separate thread posts with a blank line.' : ' · Edits here apply to this publishing request only.'}</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4 md:p-5">
            <div>
              <p className="text-sm font-semibold mb-3">3. Choose when</p>
              {deliveryMode === 'managed' && <div className="flex flex-wrap gap-5 text-sm mb-4">
                <label className="flex items-center gap-2"><input type="radio" name="publish-when" checked={publishWhen === 'now'} onChange={() => setPublishWhen('now')} />Publish now</label>
                <label className="flex items-center gap-2"><input type="radio" name="publish-when" checked={publishWhen === 'later'} onChange={() => setPublishWhen('later')} />Schedule</label>
              </div>}
              {(deliveryMode === 'manual' || publishWhen === 'later') && <label htmlFor="plan-date" className="block text-xs text-muted">Local date and time
                <input id="plan-date" type="datetime-local" required value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="input-field mt-2" />
              </label>}
            </div>
            <div className="text-sm text-muted leading-relaxed">
              <p className="font-semibold text-white mb-2">Before you approve</p>
              <p>{selectedPlatforms.length} selected · {deliveryMode === 'managed' ? 'Automatic delivery to connected Orbact accounts' : 'Calendar reminder for manual posting'}</p>
              <p className="mt-2">Read every platform preview. Generated text and visuals need a final factual and design check.</p>
            </div>
          </div>
          {needsInstagramMedia && (
            <div className="rounded-xl border border-border p-4">
              <label htmlFor="plan-image" className="block text-sm mb-2">Finished post JPG — one page, under 4 MB</label>
              <input id="plan-image" type="file" accept="image/jpeg" onChange={(event) => uploadImage(event.target.files?.[0])} className="text-sm text-muted" />
              <p className="text-xs text-muted mt-2">The selected finished design is added automatically. You can choose another JPG here. Instagram supports one JPG per post; it is stored in a public bucket so Instagram can fetch it.</p>
              {uploading && <p role="status" className="text-xs text-violet-300 mt-2">Uploading image...</p>}
              {mediaUrl && <div className="mt-3 flex items-start gap-3"><Image unoptimized src={mediaUrl} alt="Instagram image selected for publishing" width={96} height={120} className="h-30 w-24 rounded-lg border border-white/10 object-cover" /><p role="status" className="text-xs text-success">{mediaUrl === postImageUrl ? 'Selected Orbact design ready for publishing.' : 'Uploaded image ready for publishing.'}</p></div>}
            </div>
          )}
          {deliveryMode === 'managed' && <p className="text-xs text-warning">Your click approves the exact copy and media for every selected platform. Scheduled posts on this free prototype are checked once daily around 12:00–13:00 UTC and may wait until the next day.</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy || uploading || selectedPlatforms.length === 0 || (publishWhen === 'now' && attemptFinished)} className="btn-primary text-sm">{busy ? 'Processing...' : deliveryMode === 'managed' ? publishWhen === 'now' ? `Approve & publish ${selectedPlatforms.length === connected.length ? 'all ' : ''}${selectedPlatforms.length} now` : `Approve & schedule ${selectedPlatforms.length}` : `Add ${selectedPlatforms.length} to calendar`}</button>
            {attemptFinished && <button type="button" onClick={startNewPublish} className="btn-secondary text-sm">Start a new publishing request</button>}
          </div>
          {selectedPlatforms.includes('instagram') && deliveryMode === 'manual' && <p className="text-xs text-warning">Instagram needs a finished image. Use the selected design above or your own JPEG when posting manually.</p>}
        </form>
      )}
      {!outputs && <p className="text-sm text-muted">Create or open a draft above to choose its platforms and review the posts here.</p>}
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
      </div>
    </section>
  )
}
