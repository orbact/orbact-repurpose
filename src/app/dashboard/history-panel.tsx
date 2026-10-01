'use client'

import { useEffect, useState } from 'react'
import { parseGeneratedContent, type GeneratedContent } from '@/lib/ai/content-schema'

type SavedGeneration = {
  id: string
  title: string | null
  input_raw: string
  input_type: string
  outputs: unknown
  status: string
  created_at: string
}

export default function HistoryPanel({
  refreshKey,
  onOpen,
}: {
  refreshKey: number
  onOpen: (generation: { id: string; title: string; outputs: GeneratedContent }) => void
}) {
  const [items, setItems] = useState<SavedGeneration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetch('/api/generations')
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Could not load history')
        if (live) setItems(body.generations)
      })
      .catch((cause) => { if (live) setError(cause.message) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [refreshKey])

  async function remove(id: string) {
    if (!window.confirm('Delete this saved draft? This does not restore a used generation credit.')) return
    setError(null)
    try {
    const response = await fetch('/api/generations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const body = await response.json()
    if (!response.ok) {
      setError(body.error || 'Could not delete draft')
      return
    }
    setItems((current) => current.filter((item) => item.id !== id))
    } catch {
      setError('Connection interrupted. Could not delete the draft.')
    }
  }

  return (
    <section className="glass-card p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Your library</p>
          <h2 className="text-xl font-semibold">Recent drafts</h2>
        </div>
        <span className="text-xs text-muted">Last 40</span>
      </div>
      {loading && <p role="status" className="text-sm text-muted">Loading drafts...</p>}
      {error && <p role="alert" className="text-sm text-danger mb-3">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-muted">Your completed generations will appear here.</p>
      )}
      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
        {items.map((item) => {
          const outputs = parseGeneratedContent(item.outputs)
          return (
            <div key={item.id} className="rounded-xl border border-border bg-white/[0.025] p-3">
              <p className="text-sm font-medium truncate">{item.title || item.input_raw.slice(0, 50) || 'Untitled draft'}</p>
              <p className="text-xs text-muted mt-1">
                {new Date(item.created_at).toLocaleDateString()} · {item.status}
              </p>
              <div className="flex items-center gap-3 mt-3">
                {outputs && item.status === 'complete' && (
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => onOpen({
                    id: item.id,
                    title: item.title || 'Untitled draft',
                    outputs,
                  })}>Open draft</button>
                )}
                {item.status !== 'pending' && (
                  <button type="button" className="text-xs text-muted hover:text-danger" onClick={() => remove(item.id)}>Delete</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
