export type VisualFormat = 'square' | 'portrait'
export type VisualLayout = 'editorial' | 'split'

type Word = { text: string; accent: boolean }
type VisualOptions = {
  headline: string
  format: VisualFormat
  layout?: VisualLayout
  emphasisWords?: number
  artwork?: HTMLImageElement | null
  kicker?: string
  body?: string
  footer?: 'post' | 'carousel' | 'closing'
  slideNumber?: number
}

const BLACK = '#171717'
const WHITE = '#ffffff'
const CYAN = '#00ecea'
const FONT = '"Orbact Display", Montserrat, Arial, sans-serif'

export async function loadVisualFont() {
  await Promise.all([
    document.fonts.load(`400 64px ${FONT}`),
    document.fonts.load(`750 64px ${FONT}`),
  ])
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawnWidth = image.naturalWidth * scale
  const drawnHeight = image.naturalHeight * scale
  ctx.drawImage(image, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight)
}

function drawBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number, layout: VisualLayout, artwork?: HTMLImageElement | null) {
  ctx.fillStyle = BLACK
  ctx.fillRect(0, 0, width, height)
  if (artwork) {
    ctx.save()
    ctx.globalAlpha = layout === 'split' ? 0.82 : 0.68
    drawCover(ctx, artwork, width, height)
    ctx.restore()
    const shade = ctx.createLinearGradient(0, 0, width, 0)
    shade.addColorStop(0, 'rgba(23, 23, 23, 0.90)')
    shade.addColorStop(0.55, layout === 'split' ? 'rgba(23, 23, 23, 0.67)' : 'rgba(23, 23, 23, 0.72)')
    shade.addColorStop(1, layout === 'split' ? 'rgba(23, 23, 23, 0.45)' : 'rgba(23, 23, 23, 0.58)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, width, height)
  }
  if (layout === 'split') {
    ctx.save()
    ctx.globalAlpha = artwork ? 0.54 : 0.9
    const ring = ctx.createLinearGradient(width * 0.5, height, width, height * 0.45)
    ring.addColorStop(0, '#004778')
    ring.addColorStop(0.55, '#2fb0de')
    ring.addColorStop(1, '#075886')
    ctx.strokeStyle = ring
    ctx.lineWidth = Math.round(width * 0.1)
    ctx.beginPath()
    ctx.arc(width * 0.93, height * 0.83, width * 0.4, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

function drawBrand(ctx: CanvasRenderingContext2D, width: number) {
  ctx.strokeStyle = WHITE
  ctx.lineWidth = 33
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.arc(193, 183, 70, 230 * Math.PI / 180, 550 * Math.PI / 180)
  ctx.stroke()
  ctx.textAlign = 'right'
  ctx.fillStyle = WHITE
  ctx.font = `750 52px ${FONT}`
  ctx.fillText('ORBACT', width - 110, 164)
  ctx.textAlign = 'left'
}

function wordFont(word: Word, size: number) {
  return `${word.accent ? 400 : 750} ${size}px ${FONT}`
}

function wrapHeadline(ctx: CanvasRenderingContext2D, words: Word[], size: number, maxWidth: number): Word[][] {
  const lines: Word[][] = []
  let line: Word[] = []
  let lineWidth = 0
  for (const word of words) {
    ctx.font = wordFont(word, size)
    const wordWidth = ctx.measureText(word.text).width
    const spaceWidth = line.length ? ctx.measureText(' ').width : 0
    if (line.length && lineWidth + spaceWidth + wordWidth > maxWidth) {
      lines.push(line)
      line = []
      lineWidth = 0
    }
    line.push(word)
    lineWidth += (line.length > 1 ? spaceWidth : 0) + wordWidth
  }
  if (line.length) lines.push(line)
  return lines
}

function drawHeadline(ctx: CanvasRenderingContext2D, options: VisualOptions, height: number): { fits: boolean; bottom: number } {
  const words = (options.headline.trim() || 'Your next big idea').split(/\s+/).map((text, index, all) => ({
    text,
    accent: index >= all.length - (options.emphasisWords ?? 2),
  }))
  const hasBody = Boolean(options.body?.trim())
  const firstBaseline = height === 1350 ? (options.kicker?.trim() ? 500 : 432) : (options.kicker?.trim() ? 485 : 345)
  const bottomLimit = height === 1350 ? (hasBody ? 945 : 1085) : (hasBody ? 650 : 840)
  const maxWidth = 860
  let size = height === 1350 ? 132 : (hasBody ? 160 : 138)
  let lines: Word[][] = []
  for (; size >= 50; size -= 4) {
    lines = wrapHeadline(ctx, words, size, maxWidth)
    const tooWide = words.some((word) => {
      ctx.font = wordFont(word, size)
      return ctx.measureText(word.text).width > maxWidth
    })
    const maxLines = height === 1350 ? 6 : (hasBody ? 5 : 7)
    if (!tooWide && lines.length <= maxLines &&
        firstBaseline + (lines.length - 1) * size * 1.08 <= bottomLimit) break
  }
  const fits = size >= 50
  if (!fits) {
    size = 50
    lines = wrapHeadline(ctx, words, size, maxWidth)
  }
  const lineHeight = size * 1.08
  lines.forEach((line, lineIndex) => {
    let x = 110
    const y = firstBaseline + lineIndex * lineHeight
    line.forEach((word, wordIndex) => {
      ctx.font = wordFont(word, size)
      ctx.fillStyle = word.accent ? CYAN : WHITE
      if (wordIndex) x += ctx.measureText(' ').width
      ctx.fillText(word.text, x, y)
      x += ctx.measureText(word.text).width
    })
  })
  return { fits, bottom: firstBaseline + (lines.length - 1) * lineHeight }
}

function drawBody(ctx: CanvasRenderingContext2D, body: string, startY: number, height: number): boolean {
  if (!body.trim()) return true
  const maxBottom = height - 190
  for (let size = 44; size >= 28; size -= 2) {
    ctx.font = `500 ${size}px ${FONT}`
    const words = body.trim().split(/\s+/)
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (current && ctx.measureText(candidate).width > 850) {
        lines.push(current)
        current = word
      } else current = candidate
    }
    if (current) lines.push(current)
    if (lines.length > 5 || startY + (lines.length - 1) * size * 1.35 > maxBottom ||
        lines.some((line) => ctx.measureText(line).width > 850)) continue
    ctx.fillStyle = '#e8e8e8'
    lines.forEach((line, index) => ctx.fillText(line, 110, startY + index * size * 1.35))
    return true
  }
  return false
}

function drawSocialIcons(ctx: CanvasRenderingContext2D, y: number) {
  const x = 113
  ctx.strokeStyle = WHITE
  ctx.fillStyle = WHITE
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(x, y - 23, 29, 29, 7)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + 14.5, y - 8.5, 7, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + 23, y - 16, 2, 0, Math.PI * 2)
  ctx.fill()

  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(x + 52, y - 23); ctx.lineTo(x + 77, y + 6)
  ctx.moveTo(x + 75, y - 23); ctx.lineTo(x + 50, y + 6)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x + 111, y - 8, 15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = BLACK
  ctx.font = `750 26px ${FONT}`
  ctx.fillText('f', x + 105, y + 3)

  ctx.fillStyle = WHITE
  ctx.fillRect(x + 146, y - 23, 30, 30)
  ctx.fillStyle = BLACK
  ctx.font = `750 18px ${FONT}`
  ctx.fillText('in', x + 149, y)
}

function drawFooter(ctx: CanvasRenderingContext2D, width: number, height: number, kind: VisualOptions['footer'], slideNumber?: number) {
  let x = 110
  const baseline = height - 112
  for (const [part, weight] of [['www.', 400], ['orbact', 750], ['.com', 400]] as const) {
    ctx.font = `${weight} 28px ${FONT}`
    ctx.fillStyle = WHITE
    ctx.fillText(part, x, baseline)
    x += ctx.measureText(part).width
  }
  drawSocialIcons(ctx, height - 59)
  if (kind === 'carousel') {
    ctx.textAlign = 'right'
    ctx.font = `italic 750 30px ${FONT}`
    ctx.fillText('SWIPE  →', width - 110, height - 60)
  } else if (kind === 'closing') {
    ctx.textAlign = 'right'
    ctx.font = `750 28px ${FONT}`
    ctx.fillText('SAVE THIS', width - 110, height - 60)
  } else {
    const left = width - 158
    const top = height - 139
    ctx.fillStyle = CYAN
    ctx.beginPath()
    ctx.moveTo(left, top)
    ctx.lineTo(left + 44, top)
    ctx.lineTo(left + 44, top + 62)
    ctx.lineTo(left + 22, top + 44)
    ctx.lineTo(left, top + 62)
    ctx.closePath()
    ctx.fill()
  }
  if (slideNumber && kind !== 'post') {
    ctx.textAlign = 'right'
    ctx.font = `500 20px ${FONT}`
    ctx.fillStyle = '#a8a8a8'
    ctx.fillText(String(slideNumber).padStart(2, '0'), width - 110, height - 112)
  }
  ctx.textAlign = 'left'
}

export function drawOrbactVisual(canvas: HTMLCanvasElement, options: VisualOptions): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  const width = 1080
  const height = options.format === 'portrait' ? 1350 : 1080
  canvas.width = width
  canvas.height = height
  drawBackdrop(ctx, width, height, options.layout ?? 'editorial', options.artwork)
  drawBrand(ctx, width)
  if (options.kicker?.trim()) {
    ctx.fillStyle = CYAN
    ctx.font = `650 30px ${FONT}`
    ctx.fillText(options.kicker.trim().toUpperCase().slice(0, 60), 110, height === 1350 ? 340 : 310)
  }
  const title = drawHeadline(ctx, options, height)
  const bodyFits = drawBody(ctx, options.body ?? '', title.bottom + 68, height)
  drawFooter(ctx, width, height, options.footer ?? 'post', options.slideNumber)
  return title.fits && bodyFits
}
