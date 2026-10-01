'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { GeneratedContent } from '@/lib/ai/content-schema'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function drawCard(canvas: HTMLCanvasElement, headline: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = 1080
  canvas.height = 1080
  const background = ctx.createLinearGradient(0, 0, 1080, 1080)
  background.addColorStop(0, '#1b1138')
  background.addColorStop(0.55, '#10162a')
  background.addColorStop(1, '#07121a')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, 1080, 1080)
  ctx.strokeStyle = 'rgba(151, 127, 220, 0.1)'
  ctx.lineWidth = 1
  for (let at = 80; at < 1080; at += 72) {
    ctx.beginPath(); ctx.moveTo(at, 0); ctx.lineTo(at, 1080); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, at); ctx.lineTo(1080, at); ctx.stroke()
  }
  const glow = ctx.createRadialGradient(850, 170, 10, 850, 170, 650)
  glow.addColorStop(0, 'rgba(124, 58, 237, 0.46)')
  glow.addColorStop(1, 'rgba(124, 58, 237, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 1080, 1080)
  ctx.fillStyle = '#a78bfa'
  ctx.fillRect(82, 96, 128, 8)
  ctx.font = '600 27px Arial, sans-serif'
  ctx.fillText('ORBACT  /  REPURPOSE', 82, 163)

  ctx.fillStyle = '#f8f7ff'
  ctx.font = 'bold 76px Arial, sans-serif'
  const words = headline.trim().split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && ctx.measureText(candidate).width > 900) {
      lines.push(line)
      line = word
    } else line = candidate
  }
  if (line) lines.push(line)
  const shown = lines.slice(0, 6)
  if (lines.length > 6) shown[5] = shown[5].replace(/[.,;:!?]*$/, '') + '…'
  const startY = Math.max(390, 580 - (shown.length - 1) * 48)
  shown.forEach((text, index) => ctx.fillText(text, 82, startY + index * 95, 910))

  ctx.fillStyle = '#a78bfa'
  ctx.fillRect(82, 950, 916, 2)
  ctx.font = '600 27px Arial, sans-serif'
  ctx.fillText('IDEAS MADE USEFUL', 82, 1006)
  ctx.textAlign = 'right'
  ctx.fillText('ORBACT', 998, 1006)
}

export default function ImageStudio({ outputs, aiEnabled }: {
  outputs: GeneratedContent
  aiEnabled: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const objectUrl = useRef<string | null>(null)
  const [headline, setHeadline] = useState(outputs.carousel.cover.headline)
  const [prompt, setPrompt] = useState(outputs.image_prompt || `Abstract editorial illustration about ${outputs.carousel.cover.headline}. Dark modern palette, violet and cyan light, no text or logos.`)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [generatedType, setGeneratedType] = useState('image/jpeg')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (canvasRef.current) drawCard(canvasRef.current, headline)
  }, [headline])
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current) }, [])

  function downloadCard() {
    canvasRef.current?.toBlob((blob) => {
      if (blob) downloadBlob(blob, 'orbact-social-card.jpg')
    }, 'image/jpeg', 0.92)
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

  async function downloadGenerated() {
    if (!generatedUrl) return
    const blob = await fetch(generatedUrl).then((response) => response.blob())
    const extension = generatedType === 'image/png' ? 'png' : generatedType === 'image/webp' ? 'webp' : 'jpg'
    downloadBlob(blob, `orbact-ai-image.${extension}`)
  }

  return (
    <section className="glass-card p-6 md:p-8" aria-labelledby="image-studio-title">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Create an image</p>
        <h3 id="image-studio-title" className="text-xl font-semibold">Image studio</h3>
        <p className="text-sm text-muted mt-1">Make a branded square card for free. Review every visual before publishing.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <label htmlFor="card-headline" className="block text-sm text-muted mb-2">Card headline</label>
          <input id="card-headline" value={headline} maxLength={120} onChange={(event) => setHeadline(event.target.value)} className="input-field" />
          <button type="button" onClick={downloadCard} disabled={!headline.trim()} className="btn-primary text-sm mt-4">Download branded JPEG</button>
          <p className="text-xs text-muted mt-2">1080 × 1080 pixels · ready for manual posting</p>
        </div>
        <canvas ref={canvasRef} aria-label="Preview of the branded square card" role="img" className="w-full max-w-[320px] aspect-square rounded-xl border border-border" />
      </div>

      {aiEnabled && <div className="border-t border-border mt-7 pt-7">
        <h4 className="font-semibold">AI artwork</h4>
        <p className="text-xs text-muted mt-1 mb-4">Your prompt is sent to the connected image provider. This uses its available quota.</p>
        <label htmlFor="image-prompt" className="block text-sm text-muted mb-2">Visual prompt</label>
        <textarea id="image-prompt" value={prompt} maxLength={300} rows={3} onChange={(event) => setPrompt(event.target.value)} className="input-field resize-y" />
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <button type="button" onClick={generateImage} disabled={busy || prompt.trim().length < 12} className="btn-secondary text-sm">{busy ? 'Generating image…' : 'Generate AI image'}</button>
          <span className="text-xs text-muted">{prompt.length}/300</span>
        </div>
        {error && <p role="alert" className="text-sm text-danger mt-3">{error}</p>}
        {generatedUrl && <div className="mt-5 flex flex-col items-start gap-3">
          <Image unoptimized src={generatedUrl} alt="Generated artwork preview" width={320} height={320} className="rounded-xl border border-border w-full max-w-[320px] h-auto" />
          <button type="button" onClick={downloadGenerated} className="btn-secondary text-sm">Download AI image</button>
        </div>}
      </div>}
    </section>
  )
}
