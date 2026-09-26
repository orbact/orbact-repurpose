import Link from 'next/link'

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        color: '#f5f5f7',
        fontFamily: 'sans-serif',
      }}
    >
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px 40px',
          borderBottom: '1px solid #222',
        }}
      >
        <strong>Orbact Repurpose</strong>
        <div>
          <Link href="/login" style={{ color: '#f5f5f7', marginRight: 20 }}>
            Log in
          </Link>
          <Link
            href="/login"
            style={{
              background: '#7c3aed',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 6,
              textDecoration: 'none',
            }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      <section style={{ textAlign: 'center', padding: '100px 20px 60px' }}>
        <h1 style={{ fontSize: 48, maxWidth: 700, margin: '0 auto 20px' }}>
          Turn one article into a week of social content
        </h1>
        <p style={{ fontSize: 18, color: '#a0a0ab', maxWidth: 560, margin: '0 auto 32px' }}>
          Paste a blog post, YouTube link, or your own text — get a LinkedIn post,
          a Twitter thread, an Instagram caption, and shareable quote cards in under a minute.
        </p>
        <Link
          href="/login"
          style={{
            background: '#7c3aed',
            color: '#fff',
            padding: '14px 28px',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          Try it free — 3 generations included
        </Link>
      </section>

      <section
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 40,
          padding: '40px 20px 100px',
          flexWrap: 'wrap',
        }}
      >
        {[
          { title: 'Paste anything', desc: 'A URL, a YouTube link, or raw text — we extract the ideas.' },
          { title: 'Get every platform', desc: 'LinkedIn, X, and Instagram content, written natively for each.' },
          { title: 'Shareable quote cards', desc: 'Auto-generated images with your best lines, ready to post.' },
        ].map((f) => (
          <div key={f.title} style={{ maxWidth: 260, textAlign: 'center' }}>
            <h3 style={{ marginBottom: 8 }}>{f.title}</h3>
            <p style={{ color: '#a0a0ab', fontSize: 14 }}>{f.desc}</p>
          </div>
        ))}
      </section>

      <footer
        style={{
          borderTop: '1px solid #222',
          padding: '24px 40px',
          textAlign: 'center',
          color: '#6b6b76',
          fontSize: 13,
        }}
      >
        © {new Date().getFullYear()} Orbact Repurpose
      </footer>
    </div>
  )
}