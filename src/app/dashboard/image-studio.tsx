'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { GeneratedContent } from '@/lib/ai/content-schema'
import { drawOrbactVisual, loadVisualAssets, type VisualFormat, type VisualLayout, type VisualTheme } from '@/lib/visual-template'

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
  onPrepareForPublishing: (file: File) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const objectUrl = useRef<string | null>(null)
  const [headline, setHeadline] = useState(outputs.carousel.cover.headline)
  const [prompt, setPrompt] = useState(outputs.image_prompt || `Abstract editorial illustration about ${outputs.carousel.cover.headline}. Charcoal backdrop, cyan and deep blue light, clean negative space, no text or logos.`)
  const [format, setFormat] = useState<VisualFormat>('portrait')
  const [layout, setLayout] = useState<VisualLayout>('editorial')
  const [theme, setTheme] = useState<VisualTheme>('dark')
  const [emphasisWords, setEmphasisWords] = useState(2)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [generatedType, setGeneratedType] = useState('image/jpeg')
  const [renderReady, setRenderReady] = useState(false)
  const [headlineFits, setHeadlineFits] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prepared, setPrepared] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    setRenderReady(false)
    async function render() {
      await loadVisualAssets()
      if (cancelled || !canvas) return
      if (!generatedUrl) {
        setHeadlineFits(drawOrbactVisual(canvas, { headline, format, layout, theme, emphasisWords }))
        setRenderReady(true)
        return
      }
      const artwork = new window.Image()
      artwork.onload = () => {
        if (cancelled) return
        setHeadlineFits(drawOrbactVisual(canvas, { headline, format, layout, theme, emphasisWords, artwork }))
        setRenderReady(true)
      }
      artwork.onerror = () => { if (!cancelled) setError('The artwork could not be loaded. Generate another image or remove it.') }
      artwork.src = generatedUrl
    }
    void render().catch(() => { if (!cancelled) setError('The visual font or brand icons could not load. Refresh the page and try again.') })
    return () => { cancelled = true }
  }, [headline, format, layout, theme, emphasisWords, generatedUrl])
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current) }, [])

  function downloadCard() {
    if (!renderReady || !headlineFits) return
    canvasRef.current?.toBlob((blob) => {
      if (blob) downloadBlob(blob, `orbact-${format}-post.png`)
    }, 'image/png')
  }

  function prepareForPublishing() {
    if (!renderReady || !headlineFits) return
    canvasRef.current?.toBlob((blob) => {
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
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

  return (
    <section className="glass-card p-6 md:p-8" aria-labelledby="image-studio-title">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Create a visual</p>
        <h3 id="image-studio-title" className="text-xl font-semibold">Image studio</h3>
        <p className="text-sm text-muted mt-1">Orbact typography, light or dark contrast, and optional AI artwork behind the design. Preview the result before exporting.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div>
            <label htmlFor="card-headline" className="block text-sm text-muted mb-2">Headline</label>
            <textarea id="card-headline" value={headline} maxLength={120} rows={3} onChange={(event) => setHeadline(event.target.value)} className="input-field resize-y" />
            <p className="text-xs text-muted mt-1">Keep it short so it stays readable on a phone. {headline.length}/120</p>
            {!headlineFits && <p role="alert" className="text-xs text-warning mt-2">The headline is too long for this layout. Shorten it or choose portrait before downloading.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="card-format" className="block text-sm text-muted mb-2">Format</label>
              <select id="card-format" value={format} onChange={(event) => setFormat(event.target.value as VisualFormat)} className="input-field">
                <option value="square">Square 1:1</option>
                <option value="portrait">Portrait 4:5</option>
              </select>
            </div>
            <div>
              <label htmlFor="card-layout" className="block text-sm text-muted mb-2">Layout</label>
              <select id="card-layout" value={layout} onChange={(event) => setLayout(event.target.value as VisualLayout)} className="input-field">
                <option value="editorial">Minimal editorial</option>
                <option value="split">Blue arc</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="card-theme" className="block text-sm text-muted mb-2">Visual theme</label>
            <select id="card-theme" value={theme} onChange={(event) => setTheme(event.target.value as VisualTheme)} className="input-field">
              <option value="dark">Dark · light text</option>
              <option value="light">Light · dark text</option>
            </select>
          </div>
          <div>
            <label htmlFor="card-emphasis" className="block text-sm text-muted mb-2">Accent emphasis</label>
            <select id="card-emphasis" value={emphasisWords} onChange={(event) => setEmphasisWords(Number(event.target.value))} className="input-field">
              <option value={1}>Last word</option>
              <option value={2}>Last 2 words</option>
              <option value={3}>Last 3 words</option>
              <option value={0}>None</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadCard} disabled={!headline.trim() || !renderReady || !headlineFits} className="btn-primary text-sm">Download finished PNG</button>
            <button type="button" onClick={prepareForPublishing} disabled={!headline.trim() || !renderReady || !headlineFits} className="btn-secondary text-sm">Use for Instagram</button>
          </div>
          {prepared && <p role="status" className="text-xs text-success">JPEG ready. In Content calendar, select Instagram and attach the finished design.</p>}
          <p className="text-xs text-muted">{format === 'square' ? '1080 × 1080' : '1080 × 1350'} pixels. Review the final image before posting.</p>
        </div>
        <canvas ref={canvasRef} aria-label="Preview of the finished branded social image" role="img" className="w-full max-w-[360px] h-auto rounded-md border border-white/10 bg-[#171717]" />
      </div>

      {aiEnabled && <div className="border-t border-border mt-7 pt-7">
        <h4 className="font-semibold">Optional AI artwork</h4>
        <p className="text-xs text-muted mt-1 mb-4">Describe the scene, without text or logos. Your prompt goes to Cloudflare Workers AI and uses its daily free allocation.</p>
        <label htmlFor="image-prompt" className="block text-sm text-muted mb-2">Visual prompt</label>
        <textarea id="image-prompt" value={prompt} maxLength={300} rows={3} onChange={(event) => setPrompt(event.target.value)} className="input-field resize-y" />
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <button type="button" onClick={generateImage} disabled={busy || prompt.trim().length < 12} className="btn-secondary text-sm">{busy ? 'Generating artwork…' : generatedUrl ? 'Regenerate artwork' : 'Generate artwork'}</button>
          <span className="text-xs text-muted">{prompt.length}/300</span>
        </div>
        {error && <p role="alert" className="text-sm text-danger mt-3">{error}</p>}
        {generatedUrl && <div className="mt-5 flex flex-wrap items-center gap-4">
          <Image unoptimized src={generatedUrl} alt="AI artwork without text" width={96} height={96} className="rounded-lg border border-border w-24 h-24 object-cover" />
          <button type="button" onClick={downloadArtwork} className="btn-secondary text-sm">Download artwork only</button>
          <button type="button" onClick={removeArtwork} className="text-sm text-muted hover:text-foreground underline">Remove artwork</button>
        </div>}
        {generatedUrl && <p className="text-xs text-muted mt-3">Artwork stays in this browser session. Download the finished design before leaving this draft.</p>}
      </div>}
    </section>
  )
}
