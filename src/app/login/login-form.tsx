'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default function LoginForm({ callbackError, googleEnabled, emailSignupEnabled, passwordResetEnabled }: {
  callbackError: boolean
  googleEnabled: boolean
  emailSignupEnabled: boolean
  passwordResetEnabled: boolean
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState<string | null>(
    callbackError ? 'That sign-in link could not be used. Please try again.' : null
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)

    try {
      const { data, error } = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
      if (error) {
        setError(error.message)
        return
      }
      if (mode === 'signup' && !data.session) {
        setNotice('Check your email for a confirmation link, then log in.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Could not connect to sign-in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setError(null)
    setNotice(null)
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback`, skipBrowserRedirect: true },
      })
      if (error) setError(error.message)
      else if (data.url) window.location.assign(data.url)
      else setError('Could not start Google sign-in. Please try again.')
    } catch {
      setError('Could not connect to Google sign-in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden px-6">
      <div className="gradient-orb orb-violet w-[400px] h-[400px] -top-20 -left-20" />
      <div className="gradient-orb orb-blue w-[350px] h-[350px] -bottom-20 -right-20" />

      <div className="relative z-10 w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <Image src="/logo.png" alt="Orbact" width={32} height={32} />
          <span className="font-semibold text-lg">
            Orbact <span className="text-muted font-normal">Repurpose</span>
          </span>
        </Link>

        <div className="glass-card p-8">
          <h1 className="text-xl font-semibold mb-1 text-center">
            {mode === 'login' ? 'Sign in to Orbact' : 'Create your account'}
          </h1>
          <p className="text-sm text-muted text-center mb-6">{mode === 'signup'
            ? 'Start with 3 free generations'
            : googleEnabled ? 'Continue with Google, or sign in with your existing email account.' : 'Log in to keep repurposing your content'}</p>

          {googleEnabled && <><button type="button" onClick={handleGoogleLogin} disabled={loading} className="btn-primary w-full">
            {loading ? 'Please wait...' : 'Continue with Google'}
          </button>
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted">or use email</span>
            <div className="flex-1 h-px bg-border" />
          </div></>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field"
            />
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'signup' ? 8 : undefined}
              className="input-field"
            />

            {error && <p role="alert" className="text-danger text-sm">{error}</p>}
            {notice && <p role="status" className="text-success text-sm">{notice}</p>}

            <button type="submit" disabled={loading} className="btn-primary mt-1">
              {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Sign up'}
            </button>
          </form>

          {mode === 'login' && passwordResetEnabled && (
            <Link href="/forgot-password" className="block text-sm text-muted hover:text-foreground mt-4 text-right">
              Forgot password?
            </Link>
          )}

          {emailSignupEnabled && <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError(null)
              setNotice(null)
            }}
            className="text-sm text-muted hover:text-foreground transition-colors mt-6 w-full text-center"
          >
            {mode === 'login' ? "Need an account? Sign up" : 'Have an account? Log in'}
          </button>}
        </div>
      </div>
    </div>
  )
}
