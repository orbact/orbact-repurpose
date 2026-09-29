'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (password !== confirmation) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    const { error } = await createClient().auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setDone(true)
    setPassword('')
    setConfirmation('')
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card p-8 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-2">Choose a new password</h1>
        {done ? (
          <div role="status" className="text-sm text-success">
            Your password has been updated. <Link href="/dashboard" className="underline">Go to dashboard</Link>
          </div>
        ) : (
          <form onSubmit={updatePassword} className="flex flex-col gap-3 mt-6">
            <label htmlFor="new-password" className="text-sm font-medium">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="input-field" />
            <label htmlFor="confirm-password" className="text-sm font-medium">Confirm new password</label>
            <input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="input-field" />
            {error && <p role="alert" className="text-danger text-sm">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Updating...' : 'Update password'}</button>
          </form>
        )}
      </div>
    </main>
  )
}
