'use client'

export default function UpgradeButtons() {
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
    <div>
      <button onClick={() => handleUpgrade('starter')}>Upgrade to Starter — $19/mo</button>
      <button onClick={() => handleUpgrade('pro')} style={{ marginLeft: 10 }}>
        Upgrade to Pro — $49/mo
      </button>
    </div>
  )
}