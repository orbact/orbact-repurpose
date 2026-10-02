'use client'

import { useState } from 'react'
import type { GeneratedContent } from '@/lib/ai/content-schema'
import { drawOrbactVisual, loadVisualFont } from '@/lib/visual-template'
import ImageStudio from './image-studio'

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

async function downloadCarouselSlide(headline: string, body: string, index: number, kicker = '', last = false): Promise<boolean> {
  await loadVisualFont()
  const canvas = document.createElement('canvas')
  const fits = drawOrbactVisual(canvas, {
    headline,
    body,
    kicker,
    format: 'square',
    layout: index === 1 ? 'split' : 'editorial',
    emphasisWords: index === 1 ? 1 : 0,
    footer: last ? 'closing' : 'carousel',
    slideNumber: index,
  })
  if (!fits) return false
  return await new Promise<boolean>((resolve) => canvas.toBlob((blob) => {
    if (!blob) { resolve(false); return }
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'orbact-carousel-' + index + '.png'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    resolve(true)
  }, 'image/png'))
}

export default function OutputWorkspace({
  outputs, onChange, title, onTitleChange, onSave, saving, saveNotice, generationId, imageGenerationEnabled,
}: {
  outputs: GeneratedContent
  onChange: (outputs: GeneratedContent) => void
  title: string
  onTitleChange: (title: string) => void
  onSave: () => void
  saving: boolean
  saveNotice: string | null
  generationId: string | null
  imageGenerationEnabled: boolean
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)
  const [visualNotice, setVisualNotice] = useState<string | null>(null)

  async function saveCarouselSlide(headline: string, body: string, index: number, kicker = '', last = false) {
    try {
      const saved = await downloadCarouselSlide(headline, body, index, kicker, last)
      setVisualNotice(saved ? null : 'This slide has too much text for the design. Shorten the headline or body before downloading.')
    } catch {
      setVisualNotice('The visual font or canvas could not load. Please try downloading again.')
    }
  }

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
      ...(outputs.facebook_post ? ['## Facebook Page', outputs.facebook_post] : []),
      '## X thread', ...outputs.twitter_thread.map((tweet, index) => String(index + 1) + '. ' + tweet),
      '## Instagram', outputs.instagram_caption,
      outputs.instagram_hashtags.map((tag) => '#' + tag).join(' '),
      ...(outputs.image_prompt ? ['## Visual direction', outputs.image_prompt] : []),
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

        {outputs.facebook_post !== undefined && <article className="glass-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">Facebook Page</h3>
            <button type="button" onClick={() => copy('facebook', outputs.facebook_post || '')} className="btn-secondary text-xs">{copied === 'facebook' ? 'Copied' : 'Copy'}</button>
          </div>
          <label htmlFor="facebook-output" className="sr-only">Facebook Page post</label>
          <textarea id="facebook-output" value={outputs.facebook_post} onChange={(event) => onChange({ ...outputs, facebook_post: event.target.value })} rows={7} className={fieldClass} />
          <p className="text-xs text-muted mt-2">{outputs.facebook_post.length} characters</p>
        </article>}

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
          <p className="text-sm text-muted mt-1">Edit each card and download Orbact black-and-cyan square PNGs for manual publishing.</p>
        </div>
        {visualNotice && <p role="alert" className="text-sm text-danger mb-4">{visualNotice}</p>}
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <div style={{ fontFamily: 'Orbact Display, Montserrat, sans-serif' }} className="rounded-2xl border border-cyan-400/30 bg-[#171717] p-5 flex flex-col min-h-60">
            <span className="text-xs uppercase tracking-widest text-[#00ecea]">Cover · 01</span>
            <input aria-label="Cover headline" className="bg-transparent border-b border-white/15 text-lg font-bold mt-6 outline-none focus:border-cyan-400" value={outputs.carousel.cover.headline} onChange={(event) => onChange({ ...outputs, carousel: { ...outputs.carousel, cover: { ...outputs.carousel.cover, headline: event.target.value } } })} />
            <input aria-label="Cover accent" className="bg-transparent border-b border-white/15 text-sm text-[#00ecea] mt-2 outline-none focus:border-cyan-400" value={outputs.carousel.cover.accent} onChange={(event) => onChange({ ...outputs, carousel: { ...outputs.carousel, cover: { ...outputs.carousel.cover, accent: event.target.value } } })} />
            <button type="button" onClick={() => void saveCarouselSlide(outputs.carousel.cover.headline, '', 1, outputs.carousel.cover.accent)} className="text-xs text-[#00ecea] hover:underline mt-auto pt-6 self-start">Download PNG</button>
          </div>
          {outputs.carousel.slides.map((slide, index) => (
            <div key={index} style={{ fontFamily: 'Orbact Display, Montserrat, sans-serif' }} className="rounded-2xl border border-white/15 bg-[#171717] p-5 flex flex-col min-h-60">
              <span className="text-xs uppercase tracking-widest text-[#00ecea]">Slide · {String(index + 2).padStart(2, '0')}</span>
              <input aria-label={'Slide ' + (index + 2) + ' headline'} className="bg-transparent border-b border-white/15 text-lg font-bold mt-4 outline-none focus:border-cyan-400" value={slide.headline} onChange={(event) => {
                const slides = [...outputs.carousel.slides]
                slides[index] = { ...slide, headline: event.target.value }
                onChange({ ...outputs, carousel: { ...outputs.carousel, slides } })
              }} />
              <input aria-label={'Slide ' + (index + 2) + ' accent'} className="bg-transparent border-b border-white/15 text-sm text-[#00ecea] mt-2 outline-none focus:border-cyan-400" value={slide.accent} onChange={(event) => {
                const slides = [...outputs.carousel.slides]
                slides[index] = { ...slide, accent: event.target.value }
                onChange({ ...outputs, carousel: { ...outputs.carousel, slides } })
              }} />
              <textarea aria-label={'Slide ' + (index + 2) + ' body'} className="bg-transparent text-sm text-muted mt-3 resize-y outline-none min-h-20" value={slide.body} onChange={(event) => {
                const slides = [...outputs.carousel.slides]
                slides[index] = { ...slide, body: event.target.value }
                onChange({ ...outputs, carousel: { ...outputs.carousel, slides } })
              }} />
              <button type="button" onClick={() => void saveCarouselSlide(slide.headline, slide.body, index + 2, slide.accent)} className="text-xs text-[#00ecea] hover:underline mt-auto pt-3 self-start">Download PNG</button>
            </div>
          ))}
          {outputs.carousel.closing !== undefined && (
            <div style={{ fontFamily: 'Orbact Display, Montserrat, sans-serif' }} className="rounded-2xl border border-white/15 bg-[#171717] p-5 flex flex-col min-h-60">
              <span className="text-xs uppercase tracking-widest text-[#00ecea]">Closing · {String(outputs.carousel.slides.length + 2).padStart(2, '0')}</span>
              <textarea aria-label="Closing slide" className="bg-transparent text-lg font-bold mt-6 resize-y outline-none min-h-28" value={outputs.carousel.closing} onChange={(event) => onChange({ ...outputs, carousel: { ...outputs.carousel, closing: event.target.value } })} />
              <button type="button" onClick={() => void saveCarouselSlide(outputs.carousel.closing || '', '', outputs.carousel.slides.length + 2, '', true)} className="text-xs text-[#00ecea] hover:underline mt-auto pt-3 self-start">Download PNG</button>
            </div>
          )}
        </div>
      </article>
      <ImageStudio key={generationId ?? 'draft'} outputs={outputs} aiEnabled={imageGenerationEnabled} />
    </section>
  )
}
