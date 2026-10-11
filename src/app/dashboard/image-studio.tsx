'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { GeneratedContent } from '@/lib/ai/content-schema'
import { postVisualCopy } from '@/lib/post-visual-copy'
import { drawOrbactVisual, loadVisualAssets, type VisualFormat, type VisualLayout, type VisualTheme } from '@/lib/visual-template'

// shortcut: Canva Free cannot autofill templates; use manual template links until an eligible Canva plan is available.
const CONCEPTS: { name: string; description: string; layout: VisualLayout; theme: VisualTheme; canva: string }[] = [
  { name: 'Midnight editorial', description: 'Bold type, quiet charcoal space', layout: 'editorial', theme: 'dark', canva: 'EAGtmQZ2h-8' },
  { name: 'Electric arc', description: 'Technology motif with depth', layout: 'split', theme: 'dark', canva: 'EAGplKoukvk' },
  { name: 'Clean perspective', description: 'Light canvas, dark readable type', layout: 'editorial', theme: 'light', canva: 'EAGmEG2hsGI' },
]

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export default function ImageStudio({ outputs, aiEnabled, onPrepareForPublishing }: {
  outputs: GeneratedContent
  aiEnabled: boolean
  onPrepareForPublishing: (file: File | null) => void
}) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([])
  const objectUrl = useRef<string | null>(null)
  const sourceCopy = postVisualCopy(outputs)
  const [selected, setSelected] = useState(0)
  const [headline, setHeadline] = useState(sourceCopy.headline)
  const [kicker, setKicker] = useState(sourceCopy.kicker)
  const [body, setBody] = useState(sourceCopy.body)
  const [prompt, setPrompt] = useState(sourceCopy.prompt)
  const [format, setFormat] = useState<VisualFormat>('portrait')
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [generatedType, setGeneratedType] = useState('image/jpeg')
  const [renderedSignature, setRenderedSignature] = useState<string | null>(null)
  const [fits, setFits] = useState<boolean[]>([true, true, true])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [prepared, setPrepared] = useState(false)
  const signature = JSON.stringify([headline, kicker, body, format, generatedUrl])
  const renderReady = renderedSignature === signature

  useEffect(() => {
    let cancelled = false
    async function render() {
      await loadVisualAssets()
      if (cancelled) return
      let artwork: HTMLImageElement | undefined
      if (generatedUrl) {
        artwork = new window.Image()
        artwork.src = generatedUrl
        await artwork.decode()
        if (cancelled) return
      }
      const results = CONCEPTS.map((concept, index) => {
        const canvas = canvases.current[index]
        return canvas ? drawOrbactVisual(canvas, { headline, kicker, body: format === 'portrait' ? body : '', format, layout: concept.layout, theme: concept.theme, artwork }) : false
      })
      if (!cancelled) {
        setFits(results)
        setRenderedSignature(JSON.stringify([headline, kicker, body, format, generatedUrl]))
        setPrepared(false)
        onPrepareForPublishing(null)
        setError(null)
      }
    }
    void render().catch(() => { if (!cancelled) setError('The visual assets could not load. Refresh and try again.') })
    return () => { cancelled = true }
  }, [headline, kicker, body, format, generatedUrl, onPrepareForPublishing])
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current) }, [])

  function downloadCard() {
    if (!renderReady || !fits[selected]) return
    canvases.current[selected]?.toBlob((blob) => {
      if (blob) downloadBlob(blob, `orbact-${CONCEPTS[selected].name.toLowerCase().replaceAll(' ', '-')}.png`)
      else setError('Could not export this design. Please try again.')
    }, 'image/png')
  }

  function prepareForPublishing() {
    if (!renderReady || !fits[selected]) return
    canvases.current[selected]?.toBlob((blob) => {
      if (!blob || blob.size > 4_000_000) {
        setError('This finished image is too large for Instagram. Choose a simpler artwork or layout.')
        return
      }
      onPrepareForPublishing(new File([blob], 'orbact-post.jpg', { type: 'image/jpeg' }))
      setError(null)
      setPrepared(true)
    }, 'image/jpeg', 0.88)
  }

  async function generateImage() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/quote-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Could not generate the image.')
      }
      const blob = await response.blob()
      if (!blob.type.startsWith('image/')) throw new Error('The image provider returned invalid content.')
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = URL.createObjectURL(blob)
      setGeneratedType(blob.type)
      setGeneratedUrl(objectUrl.current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not generate the image.')
    } finally { setBusy(false) }
  }

  async function downloadArtwork() {
    if (!generatedUrl) return
    const blob = await fetch(generatedUrl).then((response) => response.blob())
    const extension = generatedType === 'image/png' ? 'png' : generatedType === 'image/webp' ? 'webp' : 'jpg'
    downloadBlob(blob, `orbact-ai-artwork.${extension}`)
  }

  function removeArtwork() {
    setGeneratedUrl(null)
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = null
  }

  async function copyForCanva() {
    try {
      await navigator.clipboard.writeText([
        `ORBACT — ${CONCEPTS[selected].name}`,
        `Headline: ${headline}`, `Eyebrow: ${kicker}`, `Supporting text: ${body}`,
        'Brand: charcoal or white, cyan #00ECEA; Orbact logo and ORBACT in the header.',
        'Footer: www.orbact.com and official social icons. Replace all template sample copy and branding.',
        `Instagram caption: ${outputs.instagram_caption}`,
        `Hashtags: ${outputs.instagram_hashtags.map((tag) => `#${tag}`).join(' ')}`,
      ].join('\n'))
      setNotice('Post copy and brand notes copied for Canva.')
    } catch { setNotice('Clipboard access failed. Copy the headline and supporting text above manually.') }
  }

  return <section className="glass-card p-6 md:p-8" aria-labelledby="image-studio-title">
    <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Visual concepts</p>
    <h3 id="image-studio-title" className="text-xl font-semibold">Choose your post design</h3>
    <p className="text-sm text-muted mt-2">Three finished concepts use the headline and supporting idea generated from your source. Edit the copy, compare, then export your choice.</p>
    <div className="grid gap-5 lg:grid-cols-3 mt-6">
      {CONCEPTS.map((concept, index) => <article key={concept.name} className={`rounded-2xl border p-3 transition-colors ${selected === index ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/15 bg-white/[0.03]'}`}>
        <canvas ref={(node) => { canvases.current[index] = node }} role="img" aria-label={`${concept.name} preview with your post content`} className="w-full h-auto rounded-lg bg-[#171717]" />
        <div className="flex items-start justify-between gap-2 mt-3">
          <div><h4 className="font-semibold text-sm">{concept.name}</h4><p className="text-xs text-muted mt-1">{concept.description}</p></div>
          <button type="button" onClick={() => { setSelected(index); setPrepared(false); onPrepareForPublishing(null) }} aria-pressed={selected === index} className={selected === index ? 'text-xs text-cyan-300 font-semibold' : 'text-xs text-muted hover:text-cyan-300'}>{selected === index ? 'Selected ✓' : 'Select'}</button>
        </div>
        {!fits[index] && <p role="alert" className="text-xs text-warning mt-2">Copy does not fit. Shorten it below.</p>}
      </article>)}
    </div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] mt-7">
      <div className="space-y-4">
        <div><label htmlFor="card-headline" className="block text-sm text-muted mb-2">Headline</label><textarea id="card-headline" value={headline} maxLength={120} rows={2} onChange={(event) => setHeadline(event.target.value)} className="input-field resize-y" /></div>
        <div><label htmlFor="card-kicker" className="block text-sm text-muted mb-2">Small heading</label><input id="card-kicker" value={kicker} maxLength={80} onChange={(event) => setKicker(event.target.value)} className="input-field" /></div>
        <div><label htmlFor="card-body" className="block text-sm text-muted mb-2">Supporting idea</label><textarea id="card-body" value={body} maxLength={160} rows={2} onChange={(event) => setBody(event.target.value)} className="input-field resize-y" /></div>
      </div>
      <div><label htmlFor="card-format" className="block text-sm text-muted mb-2">Format</label><select id="card-format" value={format} onChange={(event) => setFormat(event.target.value as VisualFormat)} className="input-field"><option value="portrait">Portrait 4:5</option><option value="square">Square 1:1</option></select><p className="text-xs text-muted mt-3">{format === 'portrait' ? '1080 × 1350' : '1080 × 1080'} pixels</p>{format === 'square' && <p className="text-xs text-muted mt-2">Square designs use the headline and small heading; supporting text stays in the caption.</p>}</div>
    </div>
    <div className="flex flex-wrap gap-2 mt-6">
      <button type="button" onClick={downloadCard} disabled={!headline.trim() || !renderReady || !fits[selected]} className="btn-primary text-sm">Download selected PNG</button>
      <button type="button" onClick={prepareForPublishing} disabled={!headline.trim() || !renderReady || !fits[selected]} className="btn-secondary text-sm">Use selected for Instagram</button>
      <button type="button" onClick={() => void copyForCanva()} className="btn-secondary text-sm">Copy copy for Canva</button>
      <a href={`https://www.canva.com/templates/${CONCEPTS[selected].canva}/`} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">Open similar Canva template ↗</a>
    </div>
    {prepared && <p role="status" className="text-xs text-success mt-3">Selected JPG ready. Choose Instagram under Publish on platforms and attach the generated visual.</p>}
    {notice && <p role="status" className="text-xs text-muted mt-3">{notice}</p>}
    <p className="text-xs text-muted mt-3">Previews are original Orbact designs made in the app. The Canva link opens a separate template for manual editing; Canva Free cannot automatically fill it from this draft. Some templates may contain Pro elements.</p>
    {error && <p role="alert" className="text-sm text-danger mt-4">{error}</p>}
    {aiEnabled && <div className="border-t border-border mt-7 pt-7">
      <h4 className="font-semibold">Optional AI artwork</h4>
      <p className="text-xs text-muted mt-1 mb-4">Generate one source-aware background for all three concepts. This uses Cloudflare Workers AI’s daily free allocation.</p>
      <label htmlFor="image-prompt" className="block text-sm text-muted mb-2">Visual prompt</label>
      <textarea id="image-prompt" value={prompt} maxLength={300} rows={3} onChange={(event) => setPrompt(event.target.value)} className="input-field resize-y" />
      <div className="flex items-center gap-3 mt-3 flex-wrap"><button type="button" onClick={generateImage} disabled={busy || prompt.trim().length < 12} className="btn-secondary text-sm">{busy ? 'Generating artwork…' : generatedUrl ? 'Regenerate artwork' : 'Generate artwork'}</button><span className="text-xs text-muted">{prompt.length}/300</span></div>
      {generatedUrl && <div className="mt-5 flex flex-wrap items-center gap-4"><Image unoptimized src={generatedUrl} alt="AI artwork without text" width={96} height={96} className="rounded-lg border border-border w-24 h-24 object-cover" /><button type="button" onClick={downloadArtwork} className="btn-secondary text-sm">Download artwork only</button><button type="button" onClick={removeArtwork} className="text-sm text-muted hover:text-foreground underline">Remove artwork</button></div>}
      {generatedUrl && <p className="text-xs text-muted mt-3">Artwork stays in this browser session. Download the finished design before leaving this draft.</p>}
    </div>}
  </section>
}
