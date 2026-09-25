'use client'
import QuoteCard from './quote-card'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type QuoteImageState = { imageDataUrl: string | null; error: string | null }

export default function ExtractTest() {
  const [type, setType] = useState<'url' | 'text' | 'youtube'>('url')
  const [input, setInput] = useState('')
  const [extracted, setExtracted] = useState<any>(null)
  const [outputs, setOutputs] = useState<any>(null)
  const [quoteImages, setQuoteImages] = useState<QuoteImageState[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<'idle' | 'extracting' | 'generating'>('idle')
  const router = useRouter()

  async function handleExtract() {
    setLoading('extracting')
    setError(null)
    setExtracted(null)
    setOutputs(null)
    setQuoteImages([])

    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, input }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setLoading('idle')
      return
    }
    setExtracted(data)
    setLoading('idle')
  }

  async function generateQuoteImages(quotes: string[], theme: string) {
    setQuoteImages(quotes.map(() => ({ imageDataUrl: null, error: null })))

    // Sequential on purpose — Pollinations rate-limits concurrent requests
    // from the same server, so we process one image at a time.
    for (let i = 0; i < quotes.length; i++) {
      try {
        const res = await fetch('/api/quote-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `abstract minimal background, ${theme}, dark moody gradient, no text, no words, no letters`,
            seed: i + 1,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        setQuoteImages((prev) => {
          const next = [...prev]
          next[i] = { imageDataUrl: data.imageDataUrl, error: null }
          return next
        })
      } catch (err) {
        setQuoteImages((prev) => {
          const next = [...prev]
          next[i] = {
            imageDataUrl: null,
            error: err instanceof Error ? err.message : 'Failed',
          }
          return next
        })
      }
    }
  }

  async function handleGenerate() {
    setLoading('generating')
    setError(null)
    setOutputs(null)
    setQuoteImages([])

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: extracted.title,
        text: extracted.text,
        sourceType: extracted.sourceType,
      }),
    })
    const data = await res.json()
    setLoading('idle')

    if (!res.ok) {
      setError(data.error)
      return
    }
    setOutputs(data.outputs)
    router.refresh() // refreshes the server-rendered usage count above

    generateQuoteImages(data.outputs.quote_highlights, extracted.title)
  }

  return (
    <div style={{ marginTop: 40, padding: 20, border: '1px solid #333' }}>
      <h2>Repurpose Content</h2>
      <select value={type} onChange={(e) => setType(e.target.value as any)}>
        <option value="url">URL</option>
        <option value="text">Pasted Text</option>
        <option value="youtube">YouTube</option>
      </select>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste a URL, text, or YouTube link"
        rows={4}
        style={{ width: '100%', marginTop: 10 }}
      />
      <button onClick={handleExtract} disabled={loading !== 'idle' || !input}>
        {loading === 'extracting' ? 'Extracting...' : '1. Extract'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {extracted && (
        <div style={{ marginTop: 20 }}>
          <strong>{extracted.title}</strong>
          <p>{extracted.text.slice(0, 300)}...</p>
          <button onClick={handleGenerate} disabled={loading !== 'idle'}>
            {loading === 'generating' ? 'Generating...' : '2. Generate Posts'}
          </button>
        </div>
      )}

      {outputs && (
        <div style={{ marginTop: 30 }}>
          <h3>LinkedIn</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{outputs.linkedin}</pre>

          <h3>Twitter/X Thread</h3>
          {outputs.twitter_thread.map((tweet: string, i: number) => (
            <p key={i}>{i + 1}. {tweet}</p>
          ))}

          <h3>Instagram Caption</h3>
          <p>{outputs.instagram_caption}</p>
          <p>{outputs.instagram_hashtags.map((h: string) => `#${h}`).join(' ')}</p>

          <h3>Quote Highlights</h3>
          <ul>
            {outputs.quote_highlights.map((q: string, i: number) => (
              <li key={i}>{q}</li>
            ))}
          </ul>

          <h3>Quote Card Images</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {outputs.quote_highlights.map((q: string, i: number) => (
              <QuoteCard
                key={i}
                quote={q}
                imageDataUrl={quoteImages[i]?.imageDataUrl ?? null}
                error={quoteImages[i]?.error ?? null}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}