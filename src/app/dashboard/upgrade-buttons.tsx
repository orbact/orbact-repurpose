'use client'

export function UpgradeButtons() {
  async function handleUpgrade(plan: 'starter' | 'pro') {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => handleUpgrade('starter')} className="btn-secondary text-sm">
        Starter — $19/mo
      </button>
      <button onClick={() => handleUpgrade('pro')} className="btn-primary text-sm">
        Pro — $49/mo
      </button>
    </div>
  )
}

export function ManageBillingButton() {
  async function handleManage() {
    const res = await fetch('/api/billing-portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else alert(data.error || 'Could not open billing portal')
  }

  return (
    <button onClick={handleManage} className="btn-secondary text-sm">
      Manage Billing
    </button>
  )
}