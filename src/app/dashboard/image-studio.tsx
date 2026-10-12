'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { GeneratedContent } from '@/lib/ai/content-schema'
import { CANVA_INSTAGRAM_TEMPLATES } from '@/lib/canva-templates'
import { postVisualCopy } from '@/lib/post-visual-copy'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export default function ImageStudio({ outputs, aiEnabled }: {
  outputs: GeneratedContent
  aiEnabled: boolean
}) {
  const sourceCopy = postVisualCopy(outputs)
  const objectUrl = useRef<string | null>(null)
  const [selected, setSelected] = useState(0)
  const [headline, setHeadline] = useState(sourceCopy.headline)
  const [kicker, setKicker] = useState(sourceCopy.kicker)
  const [body, setBody] = useState(sourceCopy.body)
  const [prompt, setPrompt] = useState(sourceCopy.prompt)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [generatedType, setGeneratedType] = useState('image/jpeg')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current) }, [])

  async function copyForCanva() {
    const template = CANVA_INSTAGRAM_TEMPLATES[selected]
    try {
      await navigator.clipboard.writeText([
        `ORBACT — ${template.name}`,
        `Headline: ${headline}`,
        `Small heading: ${kicker}`,
        `Supporting text: ${body}`,
        ...outputs.carousel.slides.map((slide, index) => `Point ${index + 1}: ${slide.headline} — ${slide.body}`),
        'Brand: replace all sample names and handles with ORBACT; use charcoal, white, and cyan #00ECEA.',
        'Header: Orbact logo on the left, ORBACT on the right. Footer: www.orbact.com and official social icons.',
        'Replace the sample photo with source-relevant artwork and check contrast and spacing before export.',
        `Caption: ${outputs.instagram_caption}`,
        `Hashtags: ${outputs.instagram_hashtags.map((tag) => `#${tag}`).join(' ')}`,
      ].join('\n\n'))
      setNotice('Source-based copy and Orbact brand notes copied. Replace the sample content in Canva.')
    } catch { setNotice('Clipboard access failed. Select and copy the text fields above manually.') }
  }

  async function generateImage() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/quote-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }),
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
    try {
      const blob = await fetch(generatedUrl).then((response) => response.blob())
      const extension = generatedType === 'image/png' ? 'png' : generatedType === 'image/webp' ? 'webp' : 'jpg'
      downloadBlob(blob, `orbact-source-artwork.${extension}`)
    } catch { setError('Could not download the artwork. Generate it again.') }
  }

  function removeArtwork() {
    setGeneratedUrl(null)
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = null
  }

  return <section className="glass-card p-6 md:p-8" aria-labelledby="image-studio-title">
    <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Canva design studio</p>
    <h3 id="image-studio-title" className="text-xl font-semibold">Create the post in Canva</h3>
    <p className="text-sm text-muted mt-2">Choose one of three real Canva Instagram templates. Your source-based copy is ready below; customise the chosen template in Canva, then upload its finished JPG when publishing.</p>
    <div className="grid gap-4 md:grid-cols-3 mt-6" aria-label="Canva Instagram templates">
      {CANVA_INSTAGRAM_TEMPLATES.map((template, index) => <article key={template.id} className={`rounded-2xl border p-5 ${selected === index ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/15 bg-white/[0.03]'}`}>
        <span className="text-xs font-semibold tracking-widest text-cyan-300">0{index + 1} / CANVA</span>
        <h4 className="mt-4 text-lg font-semibold">{template.name}</h4>
        <p className="text-sm text-muted mt-2">{template.detail}</p>
        <p className="text-xs text-muted mt-4">Best for: {template.bestFor}</p>
        <div className="flex flex-wrap items-center gap-3 mt-5">
          <button type="button" onClick={() => setSelected(index)} aria-pressed={selected === index} className={selected === index ? 'text-sm font-semibold text-cyan-300' : 'text-sm text-white hover:text-cyan-300'}>{selected === index ? 'Selected ✓' : 'Select template'}</button>
          <a href={template.url} target="_blank" rel="noopener noreferrer" className="text-sm text-muted underline hover:text-white">Preview in Canva ↗</a>
        </div>
      </article>)}
    </div>
    <div className="grid gap-4 md:grid-cols-2 mt-7">
      <div><label htmlFor="card-headline" className="block text-sm text-muted mb-2">Headline</label><textarea id="card-headline" value={headline} maxLength={120} rows={2} onChange={(event) => setHeadline(event.target.value)} className="input-field resize-y" /></div>
      <div><label htmlFor="card-kicker" className="block text-sm text-muted mb-2">Small heading</label><input id="card-kicker" value={kicker} maxLength={80} onChange={(event) => setKicker(event.target.value)} className="input-field" /></div>
      <div className="md:col-span-2"><label htmlFor="card-body" className="block text-sm text-muted mb-2">Supporting idea</label><textarea id="card-body" value={body} maxLength={160} rows={2} onChange={(event) => setBody(event.target.value)} className="input-field resize-y" /></div>
    </div>
    <div className="flex flex-wrap gap-2 mt-6">
      <button type="button" onClick={() => void copyForCanva()} className="btn-primary text-sm">Copy post content</button>
      <a href={CANVA_INSTAGRAM_TEMPLATES[selected].url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">Open selected template in Canva ↗</a>
      <a href="/logo.png" download="orbact-logo.png" className="btn-secondary text-sm">Download Orbact logo</a>
    </div>
    {notice && <p role="status" className="text-sm text-muted mt-3">{notice}</p>}
    <p className="text-xs text-muted mt-4">In Canva, choose “Customise this template,” replace its sample copy, image, and brand with the prepared content, then export one JPG under 4 MB. <a href="#calendar" className="text-cyan-300 underline">Upload it in Publish on platforms</a>. The app no longer substitutes a locally drawn post for these templates.</p>
    <p className="text-xs text-muted mt-2">Canva Free does not allow this app to autofill the template or return its finished file automatically. These three templates were listed as free in Canva’s catalog; check for any Pro elements before exporting.</p>
    {error && <p role="alert" className="text-sm text-danger mt-4">{error}</p>}
    {aiEnabled && <div className="border-t border-border mt-7 pt-7">
      <h4 className="font-semibold">Optional source-aware artwork</h4>
      <p className="text-xs text-muted mt-1 mb-4">Generate an image for the chosen template’s photo area. This uses Cloudflare Workers AI’s daily free allocation.</p>
      <label htmlFor="image-prompt" className="block text-sm text-muted mb-2">Visual prompt</label>
      <textarea id="image-prompt" value={prompt} maxLength={300} rows={3} onChange={(event) => setPrompt(event.target.value)} className="input-field resize-y" />
      <div className="flex items-center gap-3 mt-3 flex-wrap"><button type="button" onClick={generateImage} disabled={busy || prompt.trim().length < 12} className="btn-secondary text-sm">{busy ? 'Generating artwork…' : generatedUrl ? 'Regenerate artwork' : 'Generate artwork'}</button><span className="text-xs text-muted">{prompt.length}/300</span></div>
      {generatedUrl && <div className="mt-5 flex flex-wrap items-center gap-4"><Image unoptimized src={generatedUrl} alt="AI artwork without text" width={96} height={96} className="rounded-lg border border-border w-24 h-24 object-cover" /><button type="button" onClick={() => void downloadArtwork()} className="btn-secondary text-sm">Download artwork for Canva</button><button type="button" onClick={removeArtwork} className="text-sm text-muted hover:text-foreground underline">Remove artwork</button></div>}
      {generatedUrl && <p className="text-xs text-muted mt-3">Artwork stays in this browser session. Download and upload it to Canva before leaving this draft.</p>}
    </div>}
  </section>
}
