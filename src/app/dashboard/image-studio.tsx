'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { GeneratedContent } from '@/lib/ai/content-schema'
import { POST_DESIGNS, type PostDesignId } from '@/lib/post-designs'
import { postVisualCopy } from '@/lib/post-visual-copy'

export default function ImageStudio({ outputs, aiEnabled, designEnabled, onSelectImage }: {
  outputs: GeneratedContent
  aiEnabled: boolean
  designEnabled: boolean
  onSelectImage: (url: string | null) => void
}) {
  const sourceCopy = postVisualCopy(outputs)
  const artworkBlob = useRef<Blob | null>(null)
  const artworkObjectUrl = useRef<string | null>(null)
  const [headline, setHeadline] = useState(sourceCopy.headline)
  const [kicker, setKicker] = useState(sourceCopy.kicker)
  const [body, setBody] = useState(sourceCopy.body)
  const [prompt, setPrompt] = useState(sourceCopy.prompt)
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null)
  const [artworkUrl, setArtworkUrl] = useState('')
  const [images, setImages] = useState<Partial<Record<PostDesignId, string>>>({})
  const [selected, setSelected] = useState<PostDesignId | null>(null)
  const [busy, setBusy] = useState(false)
  const [artBusy, setArtBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => () => { if (artworkObjectUrl.current) URL.revokeObjectURL(artworkObjectUrl.current) }, [])

  function clearRenders() {
    setImages({})
    setSelected(null)
    onSelectImage(null)
  }

  function clearTechnologyRender() {
    setImages((current) => { const next = { ...current }; delete next.technology; return next })
    if (selected === 'technology') { setSelected(null); onSelectImage(null) }
  }

  async function renderDesign(design: PostDesignId) {
    const response = await fetch('/api/render-post', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ design, headline, kicker, body, artworkUrl }),
    })
    const result = await response.json()
    if (!response.ok || typeof result.url !== 'string') throw new Error(result.error || 'Could not finish this design.')
    return result.url as string
  }

  async function renderAll() {
    setBusy(true)
    setError(null)
    setNotice(null)
    clearRenders()
    try {
      const results = await Promise.allSettled(POST_DESIGNS.map(async (design) => ({ id: design.id, url: await renderDesign(design.id) })))
      const finished: Partial<Record<PostDesignId, string>> = {}
      const failures: string[] = []
      for (const result of results) {
        if (result.status === 'fulfilled') finished[result.value.id] = result.value.url
        else failures.push(result.reason instanceof Error ? result.reason.message : 'A design failed.')
      }
      setImages(finished)
      if (Object.keys(finished).length) setNotice(`${Object.keys(finished).length} finished design${Object.keys(finished).length === 1 ? '' : 's'} ready. Choose one for Instagram.`)
      if (failures.length) setError(failures[0])
    } finally { setBusy(false) }
  }

  async function renderOne(design: PostDesignId) {
    setBusy(true)
    setError(null)
    setNotice(null)
    if (selected === design) { setSelected(null); onSelectImage(null) }
    try {
      const url = await renderDesign(design)
      setImages((current) => ({ ...current, [design]: url }))
      setNotice('Finished design ready. Select it for Instagram when you approve it.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not finish this design.')
    } finally { setBusy(false) }
  }

  async function uploadJpeg(file: Blob) {
    if (file.size > 4_000_000) throw new Error('Artwork is over 4 MB. Choose a smaller image.')
    const response = await fetch('/api/publishing-media', {
      method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: file,
    })
    const result = await response.json()
    if (!response.ok || typeof result.url !== 'string') throw new Error(result.error || 'Could not save the artwork.')
    setArtworkUrl(result.url)
    clearTechnologyRender()
    setNotice('Artwork ready. Create the Technology image design to see it beside the text.')
  }

  async function generateArtwork() {
    setArtBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/quote-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Could not generate artwork.')
      }
      const blob = await response.blob()
      if (!blob.type.startsWith('image/')) throw new Error('The provider returned invalid artwork.')
      artworkBlob.current = blob
      if (artworkObjectUrl.current) URL.revokeObjectURL(artworkObjectUrl.current)
      artworkObjectUrl.current = URL.createObjectURL(blob)
      setArtworkPreview(artworkObjectUrl.current)
      setArtworkUrl('')
      clearTechnologyRender()
      setNotice('Artwork generated. Use it as the Technology image background before rendering that design.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not generate artwork.')
    } finally { setArtBusy(false) }
  }

  async function applyArtwork() {
    if (!artworkBlob.current) return
    setArtBusy(true)
    setError(null)
    try {
      const bitmap = await createImageBitmap(artworkBlob.current)
      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = 1350
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Could not prepare the artwork.')
      const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height)
      const width = bitmap.width * scale
      const height = bitmap.height * scale
      context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
      bitmap.close()
      const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84))
      if (!jpeg) throw new Error('Could not prepare the artwork.')
      await uploadJpeg(jpeg)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the artwork.')
    } finally { setArtBusy(false) }
  }

  return <section className="glass-card p-6 md:p-8" aria-labelledby="image-studio-title">
    <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Image studio</p>
    <h3 id="image-studio-title" className="text-xl font-semibold">Finish the Instagram post</h3>
    <p className="text-sm text-muted mt-2">Review the source-based copy, create three finished Orbact designs, then choose the image that will be sent to Instagram.</p>
    <div className="grid gap-4 md:grid-cols-2 mt-6">
      <div><label htmlFor="card-headline" className="block text-sm text-muted mb-2">Headline</label><textarea id="card-headline" value={headline} maxLength={80} rows={2} onChange={(event) => { setHeadline(event.target.value); clearRenders() }} className="input-field resize-y" /></div>
      <div><label htmlFor="card-kicker" className="block text-sm text-muted mb-2">Small heading</label><input id="card-kicker" value={kicker} maxLength={40} onChange={(event) => { setKicker(event.target.value); clearRenders() }} className="input-field" /></div>
      <div className="md:col-span-2"><label htmlFor="card-body" className="block text-sm text-muted mb-2">Supporting idea</label><textarea id="card-body" value={body} maxLength={160} rows={2} onChange={(event) => { setBody(event.target.value); clearRenders() }} className="input-field resize-y" /></div>
    </div>
    {aiEnabled && <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4 md:p-5">
      <h4 className="font-semibold">Optional AI background</h4>
      <p className="text-xs text-muted mt-1 mb-4">Generate source-aware artwork without lettering for the Technology image design. The other two designs focus on typography.</p>
      <label htmlFor="image-prompt" className="block text-sm text-muted mb-2">Visual prompt</label>
      <textarea id="image-prompt" value={prompt} maxLength={300} rows={2} onChange={(event) => setPrompt(event.target.value)} className="input-field resize-y" />
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button type="button" onClick={() => void generateArtwork()} disabled={artBusy || busy || prompt.trim().length < 12} className="btn-secondary text-sm">{artBusy ? 'Preparing artwork…' : 'Generate artwork'}</button>
        {artworkPreview && !artworkUrl && <button type="button" onClick={() => void applyArtwork()} disabled={artBusy || busy} className="btn-secondary text-sm">Use as background</button>}
        {artworkUrl && <span className="text-xs text-success">Background ready</span>}
      </div>
      {artworkPreview && <Image unoptimized src={artworkPreview} alt="Generated artwork preview without text" width={96} height={120} className="mt-4 h-30 w-24 rounded-lg border border-white/10 object-cover" />}
    </div>}
    <div className="flex flex-wrap items-center gap-3 mt-6">
      <button type="button" disabled={!designEnabled || busy || artBusy || !headline.trim()} onClick={() => void renderAll()} className="btn-primary text-sm">{busy ? 'Creating designs…' : 'Create 3 design options'}</button>
      <span className="text-xs text-muted">Three finished images use three free monthly renders. Check the layout and claims before selecting.</span>
    </div>
    {!designEnabled && <p role="status" className="text-xs text-warning mt-3">The image template service is not connected yet. You can still upload a finished JPG in Publish on platforms.</p>}
    <div className="grid gap-4 md:grid-cols-3 mt-6" aria-label="Finished Instagram designs">
      {POST_DESIGNS.map((design, index) => <article key={design.id} className={`rounded-2xl border p-4 ${selected === design.id ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/15 bg-white/[0.025]'}`}>
        <div className="aspect-[4/5] overflow-hidden rounded-xl bg-[#191919] flex items-center justify-center">
          {images[design.id]
            ? <Image unoptimized src={images[design.id] || ''} alt={`${design.name} finished Instagram image`} width={324} height={405} className="h-full w-full object-contain" />
            : <span className="text-xs uppercase tracking-widest text-white/40">0{index + 1} / awaiting render</span>}
        </div>
        <h4 className="mt-4 font-semibold">{design.name}</h4>
        <p className="text-xs text-muted mt-1 min-h-9">{design.detail}</p>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <button type="button" disabled={!designEnabled || busy || artBusy || !headline.trim()} onClick={() => void renderOne(design.id)} className="text-xs text-cyan-300 disabled:opacity-40 hover:text-cyan-100">{images[design.id] ? 'Regenerate' : 'Render only this'}</button>
          {images[design.id] && <button type="button" onClick={() => { const url = images[design.id]; if (url) { setSelected(design.id); onSelectImage(url) } }} aria-pressed={selected === design.id} className="text-xs font-semibold text-white hover:text-cyan-300">{selected === design.id ? 'Selected ✓' : 'Use for Instagram'}</button>}
        </div>
      </article>)}
    </div>
    {selected && <p role="status" className="text-sm text-success mt-5">{POST_DESIGNS.find((design) => design.id === selected)?.name} is selected for Instagram. <a href="#calendar" className="underline">Review and publish it below</a>. <a href={images[selected]} target="_blank" rel="noopener noreferrer" className="underline">Open finished JPG</a> for manual posting.</p>}
    {notice && <p role="status" className="text-sm text-muted mt-3">{notice}</p>}
    {error && <p role="alert" className="text-sm text-danger mt-3">{error}</p>}
  </section>
}
