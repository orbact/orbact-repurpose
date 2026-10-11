'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ExtractResult } from '@/lib/extract'
import type { GeneratedContent, GenerationBrief } from '@/lib/ai/content-schema'
import OutputWorkspace from './output-workspace'
import HistoryPanel from './history-panel'
import PublishingPlanner from './publishing-planner'

const DEFAULT_BRIEF: GenerationBrief = {
  audience: '',
  tone: 'clear',
  offer: '',
  cta: '',
  bannedClaims: '',
}

export default function ExtractTest({ initialBrief, imageGenerationEnabled }: {
  initialBrief: GenerationBrief | null
  imageGenerationEnabled: boolean
}) {
  const [type, setType] = useState<'url' | 'text' | 'youtube'>('url')
  const [input, setInput] = useState('')
  const [extracted, setExtracted] = useState<ExtractResult | null>(null)
  const [outputs, setOutputs] = useState<GeneratedContent | null>(null)
  const [preparedImage, setPreparedImage] = useState<File | null>(null)
  const [brief, setBrief] = useState<GenerationBrief>(initialBrief ?? DEFAULT_BRIEF)
  const [brandNotice, setBrandNotice] = useState<string | null>(null)
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [historyKey, setHistoryKey] = useState(0)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<'idle' | 'extracting' | 'generating'>('idle')
  const router = useRouter()
  const sourceRevision = useRef(0)

  function changeSource(value: string) {
    sourceRevision.current += 1
    setInput(value)
    setExtracted(null)
    setRequestId(null)
    setError(null)
  }

  async function saveBrandSettings() {
    setBrandNotice(null)
    try {
      const response = await fetch('/api/brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brief),
      })
      const body = await response.json()
      setBrandNotice(response.ok ? 'Brand settings saved for future drafts.' : body.error || 'Could not save settings')
    } catch {
      setBrandNotice('Connection interrupted. Could not save settings.')
    }
  }

  async function handleExtract() {
    const revision = sourceRevision.current
    setLoading('extracting')
    setError(null)
    setExtracted(null)
    setOutputs(null)
    setPreparedImage(null)
    setGenerationId(null)
    setRequestId(null)
    setSaveNotice(null)
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, input }),
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      if (revision !== sourceRevision.current) return
      if (!res.ok) {
        setError(data.error || 'Could not read this source')
        return
      }
      setExtracted(data)
      setDraftTitle(data.title)
    } catch {
      if (revision === sourceRevision.current) setError('Network error. Check your connection and try again.')
    } finally {
      setLoading('idle')
    }
  }

  async function handleGenerate() {
    if (!extracted) return
    const currentRequestId = requestId ?? crypto.randomUUID()
    setRequestId(currentRequestId)
    setLoading('generating')
    setError(null)
    setOutputs(null)
    setSaveNotice(null)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: extracted.title,
          text: extracted.text,
          sourceType: extracted.sourceType,
          requestId: currentRequestId,
          brief,
        }),
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Generation failed')
        if (data.creditRefunded === true || (res.status >= 400 && res.status < 500 && res.status !== 409)) setRequestId(null)
        return
      }
      setGenerationId(data.id)
      setOutputs(data.outputs)
      setPreparedImage(null)
      setDraftTitle(extracted.title)
      setRequestId(null)
      setHistoryKey((key) => key + 1)
      router.refresh()
      requestAnimationFrame(() => document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' }))
    } catch {
      setError('Connection interrupted. Retry to check this same request without spending another credit.')
    } finally {
      setLoading('idle')
    }
  }

  async function saveEdits() {
    if (!generationId || !outputs) return
    setSaving(true)
    setSaveNotice(null)
    try {
      const res = await fetch('/api/generations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: generationId, title: draftTitle, outputs }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveNotice(data.error || 'Could not save edits')
        return
      }
      setOutputs(data.generation.outputs)
      setSaveNotice('Edits saved to your library.')
      setHistoryKey((key) => key + 1)
    } catch {
      setSaveNotice('Connection interrupted. Your edits are still on this page.')
    } finally {
      setSaving(false)
    }
  }

  const sourceTypes: { value: 'url' | 'text' | 'youtube'; label: string }[] = [
    { value: 'url', label: 'Article URL' },
    { value: 'text', label: 'Pasted text' },
    { value: 'youtube', label: 'YouTube' },
  ]
  const placeholders = {
    url: 'https://example.com/article',
    text: 'Paste an article, script, newsletter, or transcript...',
    youtube: 'https://www.youtube.com/watch?v=...',
  }

  return (
    <div className="space-y-8">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
        <section className="glass-card p-6 md:p-8">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">01 / Create</p>
            <h2 className="text-2xl font-semibold tracking-tight">One source. Multiple drafts.</h2>
            <p className="text-sm text-muted mt-2">Give the AI real source material, then shape the output for your audience.</p>
          </div>

          <div className="flex flex-wrap gap-2 mb-5" aria-label="Source type">
            {sourceTypes.map((item) => (
              <button key={item.value} type="button" aria-pressed={type === item.value}
                onClick={() => { setType(item.value); changeSource('') }}
                className={'px-4 py-2 rounded-full border text-sm font-medium transition-colors ' +
                  (type === item.value ? 'border-violet-400/60 bg-violet-500/20 text-white' : 'border-border text-muted hover:text-white hover:border-violet-400/40')}>
                {item.label}
              </button>
            ))}
          </div>

          {type === 'youtube' && <p className="text-xs text-muted mb-3">YouTube captions are best effort. If unavailable, paste the transcript instead.</p>}
          {type === 'url' && <p className="text-xs text-muted mb-3">Public article URLs work best. YouTube links are detected automatically. If a site blocks reading, paste its text instead.</p>}
          <label htmlFor="source-input" className="block text-sm font-medium mb-2">Source content</label>
          <textarea id="source-input" value={input} onChange={(event) => changeSource(event.target.value)}
            placeholder={placeholders[type]} rows={type === 'text' ? 8 : 3}
            maxLength={type === 'text' ? 14000 : 2048}
            className="input-field resize-y leading-relaxed" />
          <div className="flex items-center justify-between gap-4 mt-3">
            <span className="text-xs text-muted">{input.length}{type === 'text' ? '/14000' : ''} characters</span>
            <button type="button" onClick={handleExtract} disabled={loading !== 'idle' || !input.trim()} className="btn-primary text-sm">
              {loading === 'extracting' ? 'Reading source...' : 'Read source'}
            </button>
          </div>

          {extracted && (
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs uppercase tracking-[0.2em] text-success mb-2">Source ready</p>
              <h3 className="font-semibold mb-2">{extracted.title}</h3>
              <p className="text-sm text-muted line-clamp-3">{extracted.text}</p>
              <p className="text-xs text-muted mt-2">{extracted.sourceType === 'youtube' ? 'YouTube captions' : extracted.sourceType === 'url' ? 'Article text' : 'Pasted text'} · {extracted.text.length.toLocaleString()} characters ready</p>

              <details className="mt-5 rounded-xl border border-border p-4">
                <summary className="cursor-pointer text-sm font-medium">Tune the voice and offer</summary>
                <div className="grid sm:grid-cols-2 gap-4 mt-5">
                  <div>
                    <label htmlFor="brief-audience" className="text-sm text-muted">Target audience</label>
                    <input id="brief-audience" maxLength={160} value={brief.audience} onChange={(event) => setBrief({ ...brief, audience: event.target.value })} placeholder="e.g. e-commerce founders" className="input-field mt-1" />
                  </div>
                  <div>
                    <label htmlFor="brief-tone" className="text-sm text-muted">Tone</label>
                    <select id="brief-tone" value={brief.tone} onChange={(event) => setBrief({ ...brief, tone: event.target.value as GenerationBrief['tone'] })} className="input-field mt-1">
                      <option value="clear">Clear and practical</option>
                      <option value="bold">Bold and direct</option>
                      <option value="warm">Warm and approachable</option>
                      <option value="technical">Technical and precise</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="brief-offer" className="text-sm text-muted">Offer or product</label>
                    <input id="brief-offer" maxLength={200} value={brief.offer} onChange={(event) => setBrief({ ...brief, offer: event.target.value })} placeholder="Optional" className="input-field mt-1" />
                  </div>
                  <div>
                    <label htmlFor="brief-cta" className="text-sm text-muted">Preferred call to action</label>
                    <input id="brief-cta" maxLength={200} value={brief.cta} onChange={(event) => setBrief({ ...brief, cta: event.target.value })} placeholder="Optional" className="input-field mt-1" />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="brief-banned" className="text-sm text-muted">Claims or phrases to avoid</label>
                    <input id="brief-banned" maxLength={300} value={brief.bannedClaims} onChange={(event) => setBrief({ ...brief, bannedClaims: event.target.value })} placeholder="Optional" className="input-field mt-1" />
                  </div>
                </div>
                <button type="button" onClick={saveBrandSettings} className="btn-secondary text-sm mt-5">Save as my default</button>
                {brandNotice && <p role="status" className="text-sm text-muted mt-2">{brandNotice}</p>}
              </details>

              <div className="flex flex-wrap items-center gap-4 mt-5">
                <button type="button" onClick={handleGenerate} disabled={loading !== 'idle'} className="btn-primary">
                  {loading === 'generating' ? 'Creating drafts...' : 'Generate 5 draft formats'}
                </button>
                <span className="text-xs text-muted">One credit per completed generation</span>
              </div>
            </div>
          )}
          {error && <p role="alert" className="text-danger text-sm mt-4">{error}</p>}
        </section>

        <HistoryPanel refreshKey={historyKey} onOpen={(item) => {
          setOutputs(item.outputs)
          setPreparedImage(null)
          setGenerationId(item.id)
          setDraftTitle(item.title)
          setSaveNotice(null)
          requestAnimationFrame(() => document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' }))
        }} />
      </div>

      {outputs && <OutputWorkspace outputs={outputs} imageGenerationEnabled={imageGenerationEnabled} onChange={(next) => { setOutputs(next); setSaveNotice(null) }}
        title={draftTitle} onTitleChange={(next) => { setDraftTitle(next); setSaveNotice(null) }}
        onSave={saveEdits} saving={saving} saveNotice={saveNotice} generationId={generationId}
        onPrepareForPublishing={setPreparedImage} />}
      <PublishingPlanner key={generationId ?? 'no-draft'} outputs={outputs} generationId={generationId} preparedImage={preparedImage} />
    </div>
  )
}
