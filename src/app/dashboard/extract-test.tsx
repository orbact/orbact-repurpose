'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ExtractTest() {
  const [type, setType] = useState<'url' | 'text' | 'youtube'>('url')
  const [input, setInput] = useState('')
  const [extracted, setExtracted] = useState<any>(null)
  const [outputs, setOutputs] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<'idle' | 'extracting' | 'generating'>('idle')
  const router = useRouter()

  async function handleExtract() {
    setLoading('extracting')
    setError(null)
    setExtracted(null)
    setOutputs(null)

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

  async function handleGenerate() {
    setLoading('generating')
    setError(null)
    setOutputs(null)

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
        </div>
      )}
    </div>
  )
}