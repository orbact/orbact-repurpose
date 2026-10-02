'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { GeneratedContent } from '@/lib/ai/content-schema'

type Format = 'square' | 'portrait'
type Layout = 'editorial' | 'split'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawnWidth = image.naturalWidth * scale
  const drawnHeight = image.naturalHeight * scale
  ctx.drawImage(image, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight)
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const word of text.trim().split(/\s+/)) {
    const next = current ? `${current} ${word}` : word
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current)
      current = word
    } else current = next
  }
  if (current) lines.push(current)
  return lines
}

function drawCard(canvas: HTMLCanvasElement, headline: string, format: Format, layout: Layout, artwork: HTMLImageElement | null): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  const width = 1080
  const height = format === 'portrait' ? 1350 : 1080
  canvas.width = width
  canvas.height = height

  const base = ctx.createLinearGradient(0, 0, width, height)
  base.addColorStop(0, '#1d1437')
  base.addColorStop(0.5, '#0c1528')
  base.addColorStop(1, '#071219')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, width, height)

  const split = layout === 'split'
  if (artwork) {
    ctx.save()
    if (split) {
      const imageHeight = Math.round(height * 0.53)
      ctx.beginPath()
      ctx.rect(0, 0, width, imageHeight)
      ctx.clip()
    }
    drawCover(ctx, artwork, width, split ? Math.round(height * 0.53) : height)
    ctx.restore()
    const shade = ctx.createLinearGradient(0, 0, 0, height)
    shade.addColorStop(0, 'rgba(3, 8, 19, 0.58)')
    shade.addColorStop(0.42, split ? 'rgba(3, 8, 19, 0.06)' : 'rgba(3, 8, 19, 0.22)')
    shade.addColorStop(0.64, split ? '#0c1324' : 'rgba(3, 8, 19, 0.84)')
    shade.addColorStop(1, '#070b15')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, width, height)
  } else {
    const glow = ctx.createRadialGradient(840, 250, 10, 840, 250, 700)
    glow.addColorStop(0, 'rgba(139, 92, 246, 0.48)')
    glow.addColorStop(1, 'rgba(139, 92, 246, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = 'rgba(172, 156, 220, 0.12)'
    for (let x = 0; x < width; x += 90) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke()
    }
    for (let y = 0; y < height; y += 90) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
    }
    if (split) {
      ctx.fillStyle = '#0b1222'
      ctx.fillRect(0, Math.round(height * 0.53), width, Math.ceil(height * 0.47))
    }
  }

  ctx.fillStyle = '#a78bfa'
  ctx.fillRect(78, 78, 112, 8)
  ctx.fillStyle = '#f8f7ff'
  ctx.font = '700 31px Inter, Arial, sans-serif'
  ctx.fillText('ORBACT', 78, 151)
  ctx.fillStyle = '#c5c0d9'
  ctx.font = '600 23px Inter, Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('REPURPOSE  /  VISUAL STUDIO', width - 78, 145)
  ctx.textAlign = 'left'

  const textTop = split ? Math.round(height * 0.63) : Math.round(height * (artwork ? 0.59 : 0.48))
  const footerY = height - 100
  const availableHeight = footerY - textTop - 75
  let fontSize = 84
  let lines: string[] = []
  do {
    ctx.font = `800 ${fontSize}px Inter, Arial, sans-serif`
    lines = wrap(ctx, headline || 'Your next big idea', width - 156)
    if (lines.length * fontSize * 1.14 <= availableHeight && lines.length <= 5) break
    fontSize -= 4
  } while (fontSize >= 48)
  ctx.font = `800 ${fontSize}px Inter, Arial, sans-serif`
  lines = wrap(ctx, headline || 'Your next big idea', width - 156)
  const complete = lines.length <= 5 && lines.length * fontSize * 1.14 <= availableHeight
  if (lines.length > 5) {
    lines = lines.slice(0, 5)
    lines[4] = lines[4].replace(/[.,;:!?]*$/, '') + '…'
  }
  ctx.fillStyle = '#ffffff'
  lines.forEach((line, index) => ctx.fillText(line, 78, textTop + index * fontSize * 1.14, width - 156))

  ctx.fillStyle = '#a78bfa'
  ctx.fillRect(78, footerY - 29, width - 156, 2)
  ctx.fillStyle = '#d1cbe2'
  ctx.font = '600 25px Inter, Arial, sans-serif'
  ctx.fillText('IDEAS MADE USEFUL', 78, footerY + 26)
  ctx.textAlign = 'right'
  ctx.fillText('ORBACT  /  AI AUTOMATION', width - 78, footerY + 26)
  ctx.textAlign = 'left'
  return complete
}

export default function ImageStudio({ outputs, aiEnabled }: {
  outputs: GeneratedContent
  aiEnabled: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const objectUrl = useRef<string | null>(null)
  const [headline, setHeadline] = useState(outputs.carousel.cover.headline)
  const [prompt, setPrompt] = useState(outputs.image_prompt || `Abstract editorial illustration about ${outputs.carousel.cover.headline}. Dark modern palette, violet and cyan light, no text or logos.`)
  const [format, setFormat] = useState<Format>('square')
  const [layout, setLayout] = useState<Layout>('editorial')
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [generatedType, setGeneratedType] = useState('image/jpeg')
  const [renderReady, setRenderReady] = useState(false)
  const [headlineFits, setHeadlineFits] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    setRenderReady(false)
    async function render() {
      await document.fonts.ready
      if (cancelled || !canvas) return
      if (!generatedUrl) {
        setHeadlineFits(drawCard(canvas, headline, format, layout, null))
        setRenderReady(true)
        return
      }
      const artwork = new window.Image()
      artwork.onload = () => {
        if (cancelled) return
        setHeadlineFits(drawCard(canvas, headline, format, layout, artwork))
        setRenderReady(true)
      }
      artwork.onerror = () => { if (!cancelled) setError('The artwork could not be loaded. Generate another image or remove it.') }
      artwork.src = generatedUrl
    }
    void render()
    return () => { cancelled = true }
  }, [headline, format, layout, generatedUrl])
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current) }, [])

  function downloadCard() {
    if (!renderReady || !headlineFits) return
    canvasRef.current?.toBlob((blob) => {
      if (blob) downloadBlob(blob, `orbact-${format}-post.png`)
    }, 'image/png')
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
        <p className="text-sm text-muted mt-1">Create a branded social image. AI artwork is optional; text is rendered separately for crisp, editable typography.</p>
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
              <select id="card-format" value={format} onChange={(event) => setFormat(event.target.value as Format)} className="input-field">
                <option value="square">Square 1:1</option>
                <option value="portrait">Portrait 4:5</option>
              </select>
            </div>
            <div>
              <label htmlFor="card-layout" className="block text-sm text-muted mb-2">Layout</label>
              <select id="card-layout" value={layout} onChange={(event) => setLayout(event.target.value as Layout)} className="input-field">
                <option value="editorial">Editorial</option>
                <option value="split">Image + text panel</option>
              </select>
            </div>
          </div>
          <button type="button" onClick={downloadCard} disabled={!headline.trim() || !renderReady || !headlineFits} className="btn-primary text-sm">Download finished PNG</button>
          <p className="text-xs text-muted">{format === 'square' ? '1080 × 1080' : '1080 × 1350'} pixels. Review the final image before posting.</p>
        </div>
        <canvas ref={canvasRef} aria-label="Preview of the finished branded social image" role="img" className="w-full max-w-[360px] h-auto rounded-xl border border-border" />
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
