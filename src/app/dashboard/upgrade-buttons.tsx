'use client'

import { useState } from 'react'

export function UpgradeButtons() {
  const [busy, setBusy] = useState<'starter' | 'pro' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleUpgrade(plan: 'starter' | 'pro') {
    setBusy(plan)
    setError(null)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not start checkout')
        return
      }
      window.location.assign(data.url)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy !== null} onClick={() => handleUpgrade('starter')} className="btn-secondary text-sm">
          {busy === 'starter' ? 'Opening...' : 'Starter — $19/mo'}
        </button>
        <button type="button" disabled={busy !== null} onClick={() => handleUpgrade('pro')} className="btn-primary text-sm">
          {busy === 'pro' ? 'Opening...' : 'Pro — $49/mo'}
        </button>
      </div>
      {error && <p role="alert" className="text-danger text-xs mt-3">{error}</p>}
    </div>
  )
}

export function ManageBillingButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleManage() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/billing-portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not open billing portal')
        return
      }
      window.location.assign(data.url)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button type="button" disabled={busy} onClick={handleManage} className="btn-secondary text-sm">
        {busy ? 'Opening...' : 'Manage billing'}
      </button>
      {error && <p role="alert" className="text-danger text-xs mt-3">{error}</p>}
    </div>
  )
}
