'use client'

import { useState } from 'react'

type Service = 'automation' | 'agents' | 'development' | 'unsure'

export default function ContactForm({ initialService }: { initialService: Service }) {
  const [service, setService] = useState<Service>(initialService)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'), email: form.get('email'), company: form.get('company'),
          service, challenge: form.get('challenge'), website: form.get('website'),
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body.error || 'Could not send your inquiry')
        return
      }
      setSent(true)
    } catch {
      setError('Connection interrupted. Please try again or email Orbact directly.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) return (
    <div role="status" className="glass-card p-8">
      <p className="text-success text-xs uppercase tracking-widest mb-4">Brief received</p>
      <h2 className="text-2xl font-semibold">Thanks for reaching out.</h2>
      <p className="text-muted mt-3">Your project brief has been sent to Orbact.</p>
    </div>
  )
  return (
    <form onSubmit={submit} className="glass-card p-6 md:p-8 space-y-5">
      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="contact-name" className="block text-sm mb-2">Your name *</label>
          <input id="contact-name" name="name" required maxLength={80} autoComplete="name" className="input-field" />
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-sm mb-2">Work email *</label>
          <input id="contact-email" name="email" type="email" required maxLength={254} autoComplete="email" className="input-field" />
        </div>
      </div>
      <div>
        <label htmlFor="contact-company" className="block text-sm mb-2">Company</label>
        <input id="contact-company" name="company" maxLength={120} autoComplete="organization" className="input-field" />
      </div>
      <div>
        <label htmlFor="contact-service" className="block text-sm mb-2">What can we help with? *</label>
        <select id="contact-service" value={service} onChange={(event) => setService(event.target.value as Service)} className="input-field">
          <option value="unsure">I’m not sure yet</option>
          <option value="automation">AI Automation</option>
          <option value="agents">AI Agents</option>
          <option value="development">AI Development</option>
        </select>
      </div>
      <div>
        <label htmlFor="contact-challenge" className="block text-sm mb-2">What are you trying to improve? *</label>
        <textarea id="contact-challenge" name="challenge" required minLength={20} maxLength={3000} rows={6} className="input-field resize-y" placeholder="Describe the workflow, bottleneck, or idea in a few sentences." />
      </div>
      <div className="absolute -left-[10000px]" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {error && <p role="alert" className="text-danger text-sm">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? 'Sending...' : 'Send project brief'}</button>
      <p className="text-xs text-muted">We’ll use your details to respond to this inquiry. See our privacy policy.</p>
    </form>
  )
}
