'use client'

import { useEffect, useRef } from 'react'

type QuoteCardProps = {
  quote: string
  imageDataUrl: string | null
  error: string | null
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export default function QuoteCard({ quote, imageDataUrl, error }: QuoteCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!imageDataUrl) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cancelled = false

    async function render() {
      const [bg, logo] = await Promise.all([
        loadImage(imageDataUrl!),
        loadImage('/logo.png').catch(() => null), // logo is optional — don't break the card if it fails to load
      ])
      if (cancelled || !canvas || !ctx) return

      canvas.width = 1080
      canvas.height = 1080

      // Background
      ctx.drawImage(bg, 0, 0, 1080, 1080)

      // Layered gradient overlay — darker at top and bottom for text/logo legibility,
      // lighter in the middle so the background image still reads through
      const gradient = ctx.createLinearGradient(0, 0, 0, 1080)
      gradient.addColorStop(0, 'rgba(10, 10, 15, 0.65)')
      gradient.addColorStop(0.35, 'rgba(10, 10, 15, 0.25)')
      gradient.addColorStop(0.65, 'rgba(10, 10, 15, 0.25)')
      gradient.addColorStop(1, 'rgba(10, 10, 15, 0.75)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 1080, 1080)

      // Violet accent bar — small brand touch, top-left
      ctx.fillStyle = '#7c3aed'
      ctx.fillRect(70, 70, 64, 8)

      // Large stylized quote mark behind the text, low opacity
      ctx.font = 'bold 220px Georgia, serif'
      ctx.fillStyle = 'rgba(124, 58, 237, 0.25)'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('"', 60, 140)

      // Quote text, word-wrapped and centered
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 54px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const words = quote.split(' ')
      const maxWidth = 860
      const lineHeight = 70
      const lines: string[] = []
      let currentLine = ''

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
          lines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      }
      if (currentLine) lines.push(currentLine)

      const startY = 500 - ((lines.length - 1) * lineHeight) / 2
      lines.forEach((line, i) => {
        ctx.fillText(line, 540, startY + i * lineHeight)
      })

      // Footer: real logo instead of text watermark
      if (logo) {
        const logoSize = 48
        ctx.globalAlpha = 0.85
        ctx.drawImage(logo, 540 - logoSize / 2, 960, logoSize, logoSize)
        ctx.globalAlpha = 1
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [imageDataUrl, quote])

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'quote-card.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="glass-card p-3 flex flex-col items-center gap-3 w-64">
      {!imageDataUrl && !error && (
        <div className="w-56 h-56 rounded-lg bg-white/5 animate-pulse flex items-center justify-center">
          <span className="text-xs text-muted">Generating...</span>
        </div>
      )}
      {error && (
        <div className="w-56 h-56 rounded-lg bg-white/5 flex items-center justify-center p-4">
          <span className="text-xs text-danger text-center">{error}</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="rounded-lg w-56 h-56"
        style={{ display: imageDataUrl ? 'block' : 'none' }}
      />
      {imageDataUrl && (
        <button onClick={handleDownload} className="btn-secondary text-sm w-full">
          Download
        </button>
      )}
    </div>
  )
}