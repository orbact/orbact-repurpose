'use client'

import { useEffect, useRef } from 'react'

type QuoteCardProps = {
  quote: string
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export default function QuoteCard({ quote }: QuoteCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cancelled = false

    async function render() {
      const logo = await loadImage('/logo.png').catch(() => null)
      if (cancelled || !canvas || !ctx) return

      canvas.width = 1080
      canvas.height = 1080

      // Dark background
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, 1080, 1080)

      // Soft glow accents (top-left violet, bottom-right blue)
      const glow1 = ctx.createRadialGradient(150, 150, 0, 150, 150, 500)
      glow1.addColorStop(0, 'rgba(124, 58, 237, 0.35)')
      glow1.addColorStop(1, 'rgba(124, 58, 237, 0)')
      ctx.fillStyle = glow1
      ctx.fillRect(0, 0, 1080, 1080)

      const glow2 = ctx.createRadialGradient(950, 950, 0, 950, 950, 450)
      glow2.addColorStop(0, 'rgba(59, 130, 246, 0.3)')
      glow2.addColorStop(1, 'rgba(59, 130, 246, 0)')
      ctx.fillStyle = glow2
      ctx.fillRect(0, 0, 1080, 1080)

      // Decorative diagonal ribbon behind the card
      ctx.save()
      ctx.translate(950, 550)
      ctx.rotate(-0.5)
      const ribbon = ctx.createLinearGradient(-100, 0, 100, 0)
      ribbon.addColorStop(0, '#7c3aed')
      ribbon.addColorStop(1, '#3b82f6')
      ctx.fillStyle = ribbon
      ctx.fillRect(-90, -700, 180, 1400)
      ctx.restore()

      // White card
      const cardX = 90
      const cardY = 170
      const cardW = 900
      const cardH = 760
      const radius = 40

      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
      ctx.shadowBlur = 40
      ctx.shadowOffsetY = 20
      ctx.beginPath()
      ctx.roundRect(cardX, cardY, cardW, cardH, radius)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.restore()

      // Clip to card for footer strip + content
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(cardX, cardY, cardW, cardH, radius)
      ctx.clip()

      // Violet footer strip inside the card
      const footerH = 120
      ctx.fillStyle = '#7c3aed'
      ctx.fillRect(cardX, cardY + cardH - footerH, cardW, footerH)

      // Eyebrow label
      ctx.fillStyle = '#7c3aed'
      ctx.font = 'bold 30px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText('K E Y   T A K E A W A Y', 540, 260)

      // Decorative large quote mark
      ctx.fillStyle = 'rgba(124, 58, 237, 0.85)'
      ctx.font = 'bold 160px Georgia, serif'
      ctx.textAlign = 'left'
      ctx.fillText('"', cardX + 60, 420)

      // Main quote text, word-wrapped
      ctx.fillStyle = '#111111'
      ctx.font = 'bold 46px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const words = quote.split(' ')
      const maxWidth = 740
      const lineHeight = 60
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

      const startY = 560 - ((lines.length - 1) * lineHeight) / 2
      lines.forEach((line, i) => {
        ctx.fillText(line, 540, startY + i * lineHeight)
      })

      // Logo centered in the footer strip
      if (logo) {
        const logoSize = 52
        ctx.drawImage(
          logo,
          540 - logoSize / 2,
          cardY + cardH - footerH / 2 - logoSize / 2,
          logoSize,
          logoSize
        )
      }

      ctx.restore()
    }

    render()
    return () => {
      cancelled = true
    }
  }, [quote])

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
      <canvas ref={canvasRef} className="rounded-lg w-56 h-56" />
      <button onClick={handleDownload} className="btn-secondary text-sm w-full">
        Download
      </button>
    </div>
  )
}