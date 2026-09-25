'use client'

import { useEffect, useRef } from 'react'

type QuoteCardProps = {
  quote: string
  imageDataUrl: string | null
  error: string | null
}

export default function QuoteCard({ quote, imageDataUrl, error }: QuoteCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!imageDataUrl) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      canvas.width = 1080
      canvas.height = 1080
      ctx.drawImage(img, 0, 0, 1080, 1080)

      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
      ctx.fillRect(0, 0, 1080, 1080)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 56px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const words = quote.split(' ')
      const maxWidth = 880
      const lineHeight = 72
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

      const startY = 540 - ((lines.length - 1) * lineHeight) / 2
      lines.forEach((line, i) => {
        ctx.fillText(line, 540, startY + i * lineHeight)
      })

      ctx.font = '28px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillText('Orbact Repurpose', 540, 1000)
    }
    img.src = imageDataUrl
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
    <div style={{ display: 'inline-block', margin: 10, textAlign: 'center' }}>
      {!imageDataUrl && !error && <p>Generating image...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <canvas
        ref={canvasRef}
        style={{ width: 260, height: 260, borderRadius: 8, display: imageDataUrl ? 'block' : 'none' }}
      />
      {imageDataUrl && (
        <button onClick={handleDownload} style={{ marginTop: 8 }}>
          Download
        </button>
      )}
    </div>
  )
}