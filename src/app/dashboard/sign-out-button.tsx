'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function signOut() {
    setBusy(true)
    setError(null)
    const { error } = await createClient().auth.signOut()
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    router.replace('/login')
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span role="alert" className="text-danger text-sm">{error}</span>}
      <button type="button" onClick={signOut} disabled={busy} className="text-sm text-muted hover:text-foreground disabled:opacity-50">
        {busy ? 'Signing out...' : 'Sign out'}
      </button>
    </div>
  )
}
