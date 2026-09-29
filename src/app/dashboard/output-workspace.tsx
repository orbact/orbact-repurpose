'use client'

import { useState } from 'react'
import type { GeneratedContent } from '@/lib/ai/content-schema'

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? line + ' ' + word : word
    if (line && ctx.measureText(next).width > width) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

function downloadCarouselSlide(headline: string, body: string, index: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1080
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const background = ctx.createLinearGradient(0, 0, 1080, 1080)
  background.addColorStop(0, '#100d21')
  background.addColorStop(0.6, '#17132b')
  background.addColorStop(1, '#0a0d1b')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, 1080, 1080)
  ctx.fillStyle = '#8b5cf6'
  ctx.fillRect(80, 92, 116, 8)
  ctx.fillStyle = '#aa9cd5'
  ctx.font = '600 28px Arial'
  ctx.fillText('ORBACT  /  REPURPOSE', 80, 156)
  ctx.fillStyle = '#f9f7ff'
  ctx.font = 'bold 78px Arial'
  const titleLines = wrap(ctx, headline, 900).slice(0, 5)
  titleLines.forEach((line, i) => ctx.fillText(line, 80, 370 + i * 94))
  ctx.fillStyle = '#c9c2dc'
  ctx.font = '38px Arial'
  const bodyLines = wrap(ctx, body, 880).slice(0, 8)
  const bodyY = Math.max(500, 390 + titleLines.length * 94)
  bodyLines.forEach((line, i) => ctx.fillText(line, 80, bodyY + i * 54))
  ctx.fillStyle = '#8b5cf6'
  ctx.fillRect(80, 960, 920, 2)
  ctx.fillStyle = '#aa9cd5'
  ctx.font = '600 28px Arial'
  ctx.fillText('orbact.com', 80, 1016)
  ctx.textAlign = 'right'
  ctx.fillText(String(index).padStart(2, '0'), 1000, 1016)
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'orbact-carousel-' + index + '.png'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }, 'image/png')
}

export default function OutputWorkspace({
  outputs, onChange, title, onTitleChange, onSave, saving, saveNotice, generationId,
}: {
  outputs: GeneratedContent
  onChange: (outputs: GeneratedContent) => void
  title: string
  onTitleChange: (title: string) => void
  onSave: () => void
  saving: boolean
  saveNotice: string | null
  generationId: string | null
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setCopyError(null)
    } catch {
      setCopyError('Clipboard access failed. Select the text and copy it manually.')
    }
  }

  function exportMarkdown() {
    const markdown = [
      '# ' + title,
      '## LinkedIn', outputs.linkedin,
      '## X thread', ...outputs.twitter_thread.map((tweet, index) => String(index + 1) + '. ' + tweet),
      '## Instagram', outputs.instagram_caption,
      outputs.instagram_hashtags.map((tag) => '#' + tag).join(' '),
      '## Carousel',
      'Cover: ' + outputs.carousel.cover.headline + ' ' + outputs.carousel.cover.accent,
      ...outputs.carousel.slides.map((slide, index) =>
        'Slide ' + (index + 2) + ': ' + slide.headline + ' ' + slide.accent + '\n' + slide.body),
      outputs.carousel.closing ? 'Closing: ' + outputs.carousel.closing : '',
    ].join('\n\n')
    download('orbact-draft.md', markdown, 'text/markdown;charset=utf-8')
  }

  const fieldClass = 'input-field resize-y min-h-28 leading-relaxed'
  return (
    <section id="workspace" className="space-y-5 scroll-mt-8">
      <div className="glass-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Edit & export</p>
            <label htmlFor="draft-title" className="block text-sm text-muted mb-2">Draft title</label>
            <input id="draft-title" value={title} maxLength={200} onChange={(event) => onTitleChange(event.target.value)} className="input-field font-semibold" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportMarkdown} className="btn-secondary text-sm">Export .md</button>
            <button type="button" onClick={() => download('orbact-draft.json', JSON.stringify({ title, outputs }, null, 2), 'application/json')} className="btn-secondary text-sm">Export JSON</button>
            {generationId && <button type="button" disabled={saving} onClick={onSave} className="btn-primary text-sm">{saving ? 'Saving...' : 'Save edits'}</button>}
          </div>
        </div>
        {saveNotice && <p role="status" className="text-sm text-muted mt-3">{saveNotice}</p>}
        {copyError && <p role="alert" className="text-sm text-danger mt-3">{copyError}</p>}
        <p className="text-xs text-muted mt-3">Review facts and claims before publishing. Edits are saved only when you select Save edits.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="glass-card p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">LinkedIn</h3>
            <button type="button" onClick={() => copy('linkedin', outputs.linkedin)} className="btn-secondary text-xs">{copied === 'linkedin' ? 'Copied' : 'Copy'}</button>
          </div>
          <label htmlFor="linkedin-output" className="sr-only">LinkedIn post</label>
          <textarea id="linkedin-output" value={outputs.linkedin} onChange={(event) => onChange({ ...outputs, linkedin: event.target.value })} rows={12} className={fieldClass} />
          <p className="text-xs text-muted mt-2">{outputs.linkedin.length} characters</p>
        </article>

        <article className="glass-card p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">X thread</h3>
            <button type="button" onClick={() => copy('thread', outputs.twitter_thread.join('\n\n'))} className="btn-secondary text-xs">{copied === 'thread' ? 'Copied' : 'Copy thread'}</button>
          </div>
          <div className="space-y-3">
            {outputs.twitter_thread.map((tweet, index) => (
              <div key={index}>
                <label htmlFor={'tweet-' + index} className="text-xs text-muted">Post {index + 1}</label>
                <textarea id={'tweet-' + index} value={tweet} rows={3} onChange={(event) => {
                  const tweets = [...outputs.twitter_thread]
                  tweets[index] = event.target.value
                  onChange({ ...outputs, twitter_thread: tweets })
                }} className="input-field resize-y" />
                <p className={'text-xs mt-1 ' + (tweet.length > 280 ? 'text-danger' : 'text-muted')}>{tweet.length}/280</p>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">Instagram</h3>
            <button type="button" onClick={() => copy('instagram', outputs.instagram_caption + '\n\n' + outputs.instagram_hashtags.map((tag) => '#' + tag).join(' '))} className="btn-secondary text-xs">{copied === 'instagram' ? 'Copied' : 'Copy caption'}</button>
          </div>
          <label htmlFor="instagram-output" className="text-sm text-muted">Caption</label>
          <textarea id="instagram-output" value={outputs.instagram_caption} rows={7} onChange={(event) => onChange({ ...outputs, instagram_caption: event.target.value })} className={fieldClass} />
          <p className={'text-xs mt-1 ' + (outputs.instagram_caption.length > 2200 ? 'text-danger' : 'text-muted')}>{outputs.instagram_caption.length}/2200</p>
          <label htmlFor="instagram-tags" className="block text-sm text-muted mt-4 mb-2">Hashtags (comma-separated)</label>
          <input id="instagram-tags" className="input-field" value={outputs.instagram_hashtags.join(', ')} onChange={(event) => onChange({
            ...outputs,
            instagram_hashtags: event.target.value.split(',').map((tag) => tag.trim().replace(/^#/, '')),
          })} />
        </article>
      </div>

      <article className="glass-card p-6 md:p-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Ready to design</p>
          <h3 className="text-xl font-semibold">Carousel slides</h3>
          <p className="text-sm text-muted mt-1">Edit each card and download square PNGs for manual publishing.</p>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-violet-400/25 bg-gradient-to-br from-[#1d1438] to-[#0d1327] p-5 flex flex-col min-h-60">
            <span className="text-xs uppercase tracking-widest text-violet-300">Cover · 01</span>
            <input aria-label="Cover headline" className="bg-transparent border-b border-white/10 text-lg font-semibold mt-6 outline-none focus:border-violet-400" value={outputs.carousel.cover.headline} onChange={(event) => onChange({ ...outputs, carousel: { ...outputs.carousel, cover: { ...outputs.carousel.cover, headline: event.target.value } } })} />
            <input aria-label="Cover accent" className="bg-transparent border-b border-white/10 text-lg font-semibold text-violet-300 mt-2 outline-none focus:border-violet-400" value={outputs.carousel.cover.accent} onChange={(event) => onChange({ ...outputs, carousel: { ...outputs.carousel, cover: { ...outputs.carousel.cover, accent: event.target.value } } })} />
            <button type="button" onClick={() => downloadCarouselSlide(outputs.carousel.cover.headline + ' ' + outputs.carousel.cover.accent, '', 1)} className="text-xs text-violet-300 hover:underline mt-auto pt-6 self-start">Download PNG</button>
          </div>
          {outputs.carousel.slides.map((slide, index) => (
            <div key={index} className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-[#19152d] to-[#0d1327] p-5 flex flex-col min-h-60">
              <span className="text-xs uppercase tracking-widest text-violet-300">Slide · {String(index + 2).padStart(2, '0')}</span>
              <input aria-label={'Slide ' + (index + 2) + ' headline'} className="bg-transparent border-b border-white/10 text-lg font-semibold mt-4 outline-none focus:border-violet-400" value={slide.headline} onChange={(event) => {
                const slides = [...outputs.carousel.slides]
                slides[index] = { ...slide, headline: event.target.value }
                onChange({ ...outputs, carousel: { ...outputs.carousel, slides } })
              }} />
              <input aria-label={'Slide ' + (index + 2) + ' accent'} className="bg-transparent border-b border-white/10 text-sm text-violet-300 mt-2 outline-none focus:border-violet-400" value={slide.accent} onChange={(event) => {
                const slides = [...outputs.carousel.slides]
                slides[index] = { ...slide, accent: event.target.value }
                onChange({ ...outputs, carousel: { ...outputs.carousel, slides } })
              }} />
              <textarea aria-label={'Slide ' + (index + 2) + ' body'} className="bg-transparent text-sm text-muted mt-3 resize-y outline-none min-h-20" value={slide.body} onChange={(event) => {
                const slides = [...outputs.carousel.slides]
                slides[index] = { ...slide, body: event.target.value }
                onChange({ ...outputs, carousel: { ...outputs.carousel, slides } })
              }} />
              <button type="button" onClick={() => downloadCarouselSlide(slide.headline + ' ' + slide.accent, slide.body, index + 2)} className="text-xs text-violet-300 hover:underline mt-auto pt-3 self-start">Download PNG</button>
            </div>
          ))}
          {outputs.carousel.closing !== undefined && (
            <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-[#1d1438] to-[#0d1327] p-5 flex flex-col min-h-60">
              <span className="text-xs uppercase tracking-widest text-violet-300">Closing · {String(outputs.carousel.slides.length + 2).padStart(2, '0')}</span>
              <textarea aria-label="Closing slide" className="bg-transparent text-lg font-semibold mt-6 resize-y outline-none min-h-28" value={outputs.carousel.closing} onChange={(event) => onChange({ ...outputs, carousel: { ...outputs.carousel, closing: event.target.value } })} />
              <button type="button" onClick={() => downloadCarouselSlide(outputs.carousel.closing || '', '', outputs.carousel.slides.length + 2)} className="text-xs text-violet-300 hover:underline mt-auto pt-3 self-start">Download PNG</button>
            </div>
          )}
        </div>
      </article>
    </section>
  )
}
