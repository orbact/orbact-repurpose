import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <h1>Page not found</h1>
      <p style={{ color: '#a0a0ab' }}>The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/">Go home</Link>
    </div>
  )
}
