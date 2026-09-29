'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card p-8 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-2">Reset your password</h1>
        <p className="text-sm text-muted mb-6">Enter your account email and we will send a reset link if an account exists.</p>
        <form onSubmit={requestReset} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="input-field" />
          {error && <p role="alert" className="text-danger text-sm">{error}</p>}
          {sent && <p role="status" className="text-success text-sm">If an account exists, check its inbox for a reset link.</p>}
          <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Sending...' : 'Send reset link'}</button>
        </form>
        <Link href="/login" className="block text-sm text-muted hover:text-foreground mt-6">Back to login</Link>
      </div>
    </main>
  )
}
