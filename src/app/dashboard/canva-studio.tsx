'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { GeneratedContent } from '@/lib/ai/content-schema'
import { canvaSlideCopy } from '@/lib/canva-handoff'

const TEMPLATES = [
  { id: 'EAGplKoukvk', name: 'Midnight technology', detail: 'Dark blue · 5 pages · Instagram 4:5', className: 'from-[#071124] via-[#183a72] to-[#111521]' },
  { id: 'EAGtmQZ2h-8', name: 'Monochrome tech', detail: 'Black and white · 4 pages · Instagram 4:5', className: 'from-[#141414] via-[#323232] to-[#111111]' },
  { id: 'EAGmEG2hsGI', name: 'Clean editorial', detail: 'Light monochrome · Instagram 4:5', className: 'from-[#c6cbd0] via-[#7c8894] to-[#26313d]' },
  { id: 'EAG65-M5qbY', name: 'Modern LinkedIn', detail: 'Black and white · 6 pages · LinkedIn 4:5', className: 'from-[#181818] via-[#303949] to-[#111111]' },
] as const

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export default function CanvaStudio({ outputs, aiEnabled }: { outputs: GeneratedContent; aiEnabled: boolean }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [prompt, setPrompt] = useState(outputs.image_prompt || `Abstract editorial illustration of ${outputs.carousel.cover.headline}, cyan light on charcoal, open space for headline, no words or logos.`)
  const [artUrl, setArtUrl] = useState<string | null>(null)
  const [artType, setArtType] = useState('image/jpeg')
  const [busy, setBusy] = useState(false)
  const artUrlRef = useRef<string | null>(null)

  useEffect(() => () => { if (artUrlRef.current) URL.revokeObjectURL(artUrlRef.current) }, [])

  async function copySlides() {
    try {
      await navigator.clipboard.writeText(canvaSlideCopy(outputs))
      setNotice('Slide copy and Orbact brand notes copied. Paste them into the Canva design.')
    } catch {
      setNotice('Clipboard access failed. Copy the slide text from the cards above instead.')
    }
  }

  async function generateArt() {
    setBusy(true)
    setNotice(null)
    try {
      const response = await fetch('/api/quote-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Could not generate artwork.')
      }
      const blob = await response.blob()
      if (!blob.type.startsWith('image/')) throw new Error('The image provider returned invalid content.')
      if (artUrlRef.current) URL.revokeObjectURL(artUrlRef.current)
      artUrlRef.current = URL.createObjectURL(blob)
      setArtUrl(artUrlRef.current)
      setArtType(blob.type)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not generate artwork.')
    } finally { setBusy(false) }
  }

  async function downloadArt() {
    if (!artUrl) return
    const blob = await fetch(artUrl).then((response) => response.blob())
    downloadBlob(blob, `orbact-background.${artType === 'image/png' ? 'png' : artType === 'image/webp' ? 'webp' : 'jpg'}`)
  }

  return <section className="glass-card p-6 md:p-8" aria-labelledby="canva-title">
    <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Design in Canva</p>
    <h3 id="canva-title" className="text-xl font-semibold">Turn this draft into a visual post</h3>
    <p className="text-sm text-muted mt-2">Choose a Canva community template, add your edited Orbact copy, then export the finished design. No local default template is applied.</p>
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-6" aria-label="Canva templates">
      {TEMPLATES.map((template) => <button key={template.id} type="button" onClick={() => setSelected(template.id)} aria-pressed={selected === template.id}
        className={`text-left rounded-2xl border p-3 transition-colors ${selected === template.id ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/15 hover:border-cyan-300/50'}`}>
        <span aria-hidden="true" className={`block aspect-[4/5] rounded-xl bg-gradient-to-br ${template.className} p-4 mb-3`}>
          <span className="block h-1 w-10 rounded bg-cyan-300/70" /><span className="block mt-12 h-3 w-4/5 rounded bg-white/80" /><span className="block mt-2 h-3 w-3/5 rounded bg-white/60" />
        </span>
        <span className="block text-sm font-semibold">{template.name}</span>
        <span className="block text-xs text-muted mt-1">{template.detail}</span>
      </button>)}
    </div>
    <p className="text-xs text-muted mt-3">These are previews of the styles, not Canva template artwork. Canva may change template availability or flag individual elements as Pro; replace those elements before exporting at no cost.</p>
    <div className="flex flex-wrap gap-2 mt-5">
      <button type="button" onClick={() => void copySlides()} className="btn-secondary text-sm">Copy all slide copy</button>
      {selected ? <a className="btn-primary text-sm" href={`https://www.canva.com/templates/${selected}/`} target="_blank" rel="noopener noreferrer">Open selected template in Canva ↗</a>
        : <span className="text-sm text-muted self-center">Select a template to open it.</span>}
      <a href="/logo.png" download="orbact-logo.png" className="btn-secondary text-sm">Download Orbact logo</a>
    </div>
    <ol className="list-decimal pl-5 mt-5 space-y-2 text-sm text-muted">
      <li>Copy the slide text, open your chosen template, and select <strong className="text-white">Customise this template</strong> in Canva.</li>
      <li>Replace all sample content, add the Orbact logo and ORBACT to the top safe area, set the accent to cyan, and adjust pages to fit your copy. Keep www.orbact.com and official social icons on the first and last pages only; check overlap and contrast on every page.</li>
      <li>Download a <strong className="text-white">JPG of one finished page</strong> for automatic Instagram posting, then upload it in Publish on platforms below. Download the full carousel separately for manual multi-page posting.</li>
    </ol>
    <p className="text-xs text-muted mt-4">The current automatic LinkedIn and Facebook routes publish text only. Download the Canva visual and post it manually on those Pages or on X.</p>
    <p className="text-xs text-muted mt-4">Canva editing and export happen in Canva. Its paid Autofill feature is required to populate community templates automatically; this free workflow keeps your review step.</p>
    {aiEnabled && <div className="mt-7 border-t border-white/10 pt-6">
      <h4 className="font-semibold">Optional AI background art</h4>
      <p className="text-sm text-muted mt-1 mb-3">Generate artwork here, download it, and upload it into the Canva design behind your text.</p>
      <label htmlFor="canva-art-prompt" className="sr-only">Background artwork prompt</label>
      <textarea id="canva-art-prompt" className="input-field min-h-24 resize-y" maxLength={300} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      <div className="flex flex-wrap gap-2 mt-3">
        <button type="button" disabled={busy || prompt.trim().length < 12} onClick={() => void generateArt()} className="btn-secondary text-sm">{busy ? 'Generating...' : 'Generate background'}</button>
        {artUrl && <button type="button" onClick={() => void downloadArt()} className="btn-secondary text-sm">Download background</button>}
      </div>
      {artUrl && <Image src={artUrl} width={640} height={640} unoptimized alt="Generated background artwork preview" className="mt-4 w-full max-w-sm rounded-xl border border-white/15" />}
    </div>}
    {notice && <p role="status" className="text-sm text-muted mt-4">{notice}</p>}
  </section>
}
