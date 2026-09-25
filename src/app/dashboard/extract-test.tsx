'use client'

import { useState } from 'react'

export default function ExtractTest() {
  const [type, setType] = useState<'url' | 'text' | 'youtube'>('url')
  const [input, setInput] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleTest() {
    setLoading(true)
    setError(null)
    setResult(null)

    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, input }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) setError(data.error)
    else setResult(data)
  }

  return (
    <div style={{ marginTop: 40, padding: 20, border: '1px solid #333' }}>
      <h2>Test Extraction</h2>
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
      <button onClick={handleTest} disabled={loading || !input}>
        {loading ? 'Extracting...' : 'Extract'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {result && (
        <div style={{ marginTop: 20 }}>
          <strong>{result.title}</strong>
          <p>{result.text.slice(0, 500)}...</p>
          <small>{result.text.length} characters extracted</small>
        </div>
      )}
    </div>
  )
}