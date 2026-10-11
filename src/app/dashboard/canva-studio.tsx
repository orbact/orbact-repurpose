'use client'

import { useState } from 'react'
import type { GeneratedContent } from '@/lib/ai/content-schema'
import { canvaSlideCopy } from '@/lib/canva-handoff'

const TEMPLATES = [
  { id: 'EAGplKoukvk', name: 'Midnight technology', detail: 'Dark blue · 5 pages · Instagram 4:5', className: 'from-[#071124] via-[#183a72] to-[#111521]' },
  { id: 'EAGtmQZ2h-8', name: 'Monochrome tech', detail: 'Black and white · 4 pages · Instagram 4:5', className: 'from-[#141414] via-[#323232] to-[#111111]' },
  { id: 'EAGmEG2hsGI', name: 'Clean editorial', detail: 'Light monochrome · Instagram 4:5', className: 'from-[#c6cbd0] via-[#7c8894] to-[#26313d]' },
  { id: 'EAG65-M5qbY', name: 'Modern LinkedIn', detail: 'Black and white · 6 pages · LinkedIn 4:5', className: 'from-[#181818] via-[#303949] to-[#111111]' },
] as const

export default function CanvaStudio({ outputs }: { outputs: GeneratedContent }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function copySlides() {
    try {
      await navigator.clipboard.writeText(canvaSlideCopy(outputs))
      setNotice('Slide copy and Orbact brand notes copied. Paste them into the Canva design.')
    } catch {
      setNotice('Clipboard access failed. Copy the slide text from the cards above instead.')
    }
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
    <p className="text-xs text-muted mt-4">For a finished image without Canva, use the instant Orbact visual above. Its AI artwork can also be downloaded and added to your Canva design. LinkedIn and Facebook automatic routes currently publish text only.</p>
    <p className="text-xs text-muted mt-4">Canva editing and export happen in Canva. Its paid Autofill feature is required to populate community templates automatically; this free workflow keeps your review step.</p>
    {notice && <p role="status" className="text-sm text-muted mt-4">{notice}</p>}
  </section>
}
