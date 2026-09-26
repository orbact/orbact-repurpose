'use client'

import { useEffect } from 'react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <h1>Something went wrong</h1>
      <p style={{ color: '#a0a0ab' }}>An unexpected error occurred. Please try again.</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}