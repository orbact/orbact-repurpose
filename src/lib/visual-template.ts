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
const CONTENT_LEFT = 110
const CONTENT_WIDTH = 860

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
  // This transparent header owns the top 255px of every export.
  ctx.strokeStyle = WHITE
  ctx.lineWidth = 23
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.arc(171, 157, 52, 230 * Math.PI / 180, 550 * Math.PI / 180)
  ctx.stroke()
  ctx.textAlign = 'right'
  ctx.fillStyle = WHITE
  ctx.font = `750 48px ${FONT}`
  ctx.fillText('ORBACT', width - CONTENT_LEFT, 172)
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

function fontBounds(ctx: CanvasRenderingContext2D, size: number, weight: number) {
  ctx.font = `${weight} ${size}px ${FONT}`
  const metrics = ctx.measureText('Ágj')
  return {
    ascent: Math.max(metrics.actualBoundingBoxAscent || 0, size * 0.94),
    descent: Math.max(metrics.actualBoundingBoxDescent || 0, size * 0.28),
  }
}

function wrapBody(ctx: CanvasRenderingContext2D, body: string, size: number): string[] | null {
  ctx.font = `500 ${size}px ${FONT}`
  const lines: string[] = []
  let current = ''
  for (const word of body.trim().split(/\s+/)) {
    if (ctx.measureText(word).width > CONTENT_WIDTH) return null
    const candidate = current ? `${current} ${word}` : word
    if (current && ctx.measureText(candidate).width > CONTENT_WIDTH) {
      lines.push(current)
      current = word
    } else current = candidate
  }
  if (current) lines.push(current)
  return lines
}

type TextPlacement = {
  titleLines: Word[][]
  titleSize: number
  titleBaseline: number
  titleLineHeight: number
  bodyLines: string[]
  bodySize: number
  bodyBaseline: number
  bodyLineHeight: number
}

function placeText(ctx: CanvasRenderingContext2D, options: VisualOptions, height: number): TextPlacement | null {
  const words = (options.headline.trim() || 'Your next big idea').split(/\s+/).map((text, index, all) => ({
    text,
    accent: index >= all.length - (options.emphasisWords ?? 2),
  }))
  const body = options.body?.trim() || ''
  const contentTop = options.kicker?.trim() ? 355 : 310
  const contentBottom = height - 205
  const maxTitleSize = height === 1350 ? 140 : (body ? 156 : 146)

  for (let titleSize = maxTitleSize; titleSize >= 48; titleSize -= 2) {
    const titleLines = wrapHeadline(ctx, words, titleSize, CONTENT_WIDTH)
    if (words.some((word) => {
      ctx.font = wordFont(word, titleSize)
      return ctx.measureText(word.text).width > CONTENT_WIDTH
    })) continue

    const titleBounds = fontBounds(ctx, titleSize, 750)
    const titleLineHeight = Math.max(titleSize * 1.2, titleBounds.ascent + titleBounds.descent + titleSize * 0.12)
    const titleBaseline = contentTop + titleBounds.ascent
    const titleBottom = titleBaseline + (titleLines.length - 1) * titleLineHeight + titleBounds.descent
    if (titleBottom > contentBottom) continue

    if (!body) return { titleLines, titleSize, titleBaseline, titleLineHeight, bodyLines: [], bodySize: 0, bodyBaseline: 0, bodyLineHeight: 0 }

    const bodyTop = titleBottom + 36
    for (let bodySize = 42; bodySize >= 28; bodySize -= 2) {
      const bodyLines = wrapBody(ctx, body, bodySize)
      if (!bodyLines) continue
      const bodyBounds = fontBounds(ctx, bodySize, 500)
      const bodyLineHeight = Math.max(bodySize * 1.36, bodyBounds.ascent + bodyBounds.descent + bodySize * 0.12)
      const bodyBaseline = bodyTop + bodyBounds.ascent
      const bodyBottom = bodyBaseline + (bodyLines.length - 1) * bodyLineHeight + bodyBounds.descent
      if (bodyBottom <= contentBottom) {
        return { titleLines, titleSize, titleBaseline, titleLineHeight, bodyLines, bodySize, bodyBaseline, bodyLineHeight }
      }
    }
  }
  return null
}

function drawText(ctx: CanvasRenderingContext2D, placement: TextPlacement) {
  placement.titleLines.forEach((line, lineIndex) => {
    let x = CONTENT_LEFT
    const y = placement.titleBaseline + lineIndex * placement.titleLineHeight
    line.forEach((word, wordIndex) => {
      ctx.font = wordFont(word, placement.titleSize)
      ctx.fillStyle = word.accent ? CYAN : WHITE
      if (wordIndex) x += ctx.measureText(' ').width
      ctx.fillText(word.text, x, y)
      x += ctx.measureText(word.text).width
    })
  })
  if (placement.bodyLines.length) {
    ctx.font = `500 ${placement.bodySize}px ${FONT}`
    ctx.fillStyle = '#e8e8e8'
    placement.bodyLines.forEach((line, index) => {
      ctx.fillText(line, CONTENT_LEFT, placement.bodyBaseline + index * placement.bodyLineHeight)
    })
  }
}

function drawKicker(ctx: CanvasRenderingContext2D, kicker: string) {
  let label = kicker.trim().toUpperCase()
  let size = 28
  ctx.font = `650 ${size}px ${FONT}`
  while (ctx.measureText(label).width > CONTENT_WIDTH && size > 18) {
    size -= 2
    ctx.font = `650 ${size}px ${FONT}`
  }
  while (ctx.measureText(label).width > CONTENT_WIDTH && label.length > 1) label = label.slice(0, -2) + '…'
  ctx.fillStyle = CYAN
  ctx.fillText(label, CONTENT_LEFT, 315)
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
  if (options.kicker?.trim()) drawKicker(ctx, options.kicker)
  const placement = placeText(ctx, options, height)
  if (placement) drawText(ctx, placement)
  drawFooter(ctx, width, height, options.footer ?? 'post', options.slideNumber)
  return Boolean(placement)
}
