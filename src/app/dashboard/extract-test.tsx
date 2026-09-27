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

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, input }),
      })

      if (res.status === 401) {
        window.location.href = '/login'
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        setLoading('idle')
        return
      }
      setExtracted(data)
      setLoading('idle')
    } catch {
      setError('Network error — check your connection and try again.')
      setLoading('idle')
    }
  }

  async function generateQuoteImages(quotes: string[], theme: string) {
    setQuoteImages(quotes.map(() => ({ imageDataUrl: null, error: null })))

    const styles = [
      'professional editorial magazine cover background, deep indigo and electric violet gradient, soft dramatic studio lighting, generous empty negative space in the center, minimalist premium tech aesthetic, high detail, 8k',
      'modern tech conference poster background, dark navy with neon cyan and magenta light streaks, sharp geometric shapes off to one side, large empty negative space in the center for text, premium sleek aesthetic, high detail, 8k',
      'award-winning architectural photography style background, warm amber and deep teal gradient, dramatic depth of field, generous empty negative space in the center, cinematic premium mood, high detail, 8k',
    ]

    for (let i = 0; i < quotes.length; i++) {
      try {
        const res = await fetch('/api/quote-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `${styles[i % styles.length]}, inspired by ${theme}, no text, no words, no letters, no typography`,
            seed: i + 1,
          }),
        })

        if (res.status === 401) {
          window.location.href = '/login'
          return
        }

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

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: extracted.title,
          text: extracted.text,
          sourceType: extracted.sourceType,
        }),
      })

      if (res.status === 401) {
        window.location.href = '/login'
        return
      }

      const data = await res.json()
      setLoading('idle')

      if (!res.ok) {
        setError(data.error)
        return
      }
      setOutputs(data.outputs)
      router.refresh()

      generateQuoteImages(data.outputs.quote_highlights, extracted.title)
    } catch {
      setError('Network error — check your connection and try again.')
      setLoading('idle')
    }
  }

  const types: { value: 'url' | 'text' | 'youtube'; label: string }[] = [
    { value: 'url', label: 'URL' },
    { value: 'text', label: 'Pasted Text' },
    { value: 'youtube', label: 'YouTube' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Input card */}
      <div className="glass-card p-6">
        <h2 className="font-semibold mb-4">Repurpose Content</h2>

        <div className="flex gap-2 mb-4">
          {types.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                type === t.value
                  ? 'bg-primary text-white'
                  : 'bg-white/5 text-muted hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {type === 'youtube' && (
          <p className="text-xs text-muted mb-3">
            YouTube caption extraction is best-effort and doesn't work for every video — if it fails, paste the transcript directly using "Pasted Text" instead.
          </p>
        )}

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a URL, text, or YouTube link"
          rows={4}
          className="input-field mb-4 resize-none"
        />

        <button
          onClick={handleExtract}
          disabled={loading !== 'idle' || !input}
          className="btn-primary"
        >
          {loading === 'extracting' ? 'Extracting...' : '1. Extract'}
        </button>

        {error && <p className="text-danger text-sm mt-3">{error}</p>}

        {extracted && (
          <div className="mt-5 pt-5 border-t border-border">
            <p className="font-medium mb-1">{extracted.title}</p>
            <p className="text-sm text-muted mb-4">{extracted.text.slice(0, 300)}...</p>
            <button
              onClick={handleGenerate}
              disabled={loading !== 'idle'}
              className="btn-primary"
            >
              {loading === 'generating' ? 'Generating...' : '2. Generate Posts'}
            </button>
          </div>
        )}
      </div>

      {/* Outputs */}
      {outputs && (
        <div className="flex flex-col gap-6">
          <div className="glass-card p-6">
            <h3 className="font-semibold mb-3">LinkedIn</h3>
            <p className="text-sm whitespace-pre-wrap text-muted">{outputs.linkedin}</p>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-semibold mb-3">Twitter / X Thread</h3>
            <div className="flex flex-col gap-3">
              {outputs.twitter_thread.map((tweet: string, i: number) => (
                <div key={i} className="flex gap-3">
                  <span className="text-primary font-semibold text-sm shrink-0">{i + 1}</span>
                  <p className="text-sm text-muted">{tweet}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-semibold mb-3">Instagram Caption</h3>
            <p className="text-sm text-muted mb-3">{outputs.instagram_caption}</p>
            <div className="flex flex-wrap gap-2">
              {outputs.instagram_hashtags.map((h: string, i: number) => (
                <span
                  key={i}
                  className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full"
                >
                  #{h}
                </span>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4">Quote Card Images</h3>
            <div className="flex flex-wrap gap-4">
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
        </div>
      )}
    </div>
  )
}