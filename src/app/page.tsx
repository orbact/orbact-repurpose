import Link from 'next/link'
import Image from 'next/image'

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="gradient-orb orb-violet w-[500px] h-[500px] -top-40 -left-40" />
      <div className="gradient-orb orb-blue w-[400px] h-[400px] top-96 -right-32" />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between px-6 md:px-10 py-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Orbact" width={32} height={32} />
            <span className="font-semibold text-lg">
              Orbact <span className="text-muted font-normal">Repurpose</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-foreground hover:text-primary transition-colors">
              Log in
            </Link>
            <Link href="/login" className="btn-primary text-sm">
              Get Started
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="text-center px-6 pt-24 pb-16 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Turn one article into a week of social content
          </h1>
          <p className="text-lg text-muted mb-10 max-w-xl mx-auto">
            Paste a blog post, YouTube link, or your own text — get a LinkedIn post,
            a Twitter thread, an Instagram caption, and shareable quote cards in under a minute.
          </p>
          <Link href="/login" className="btn-primary inline-block text-base">
            Try it free — 3 generations included
          </Link>
        </section>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: 'Paste anything',
              desc: 'A URL, a YouTube link, or raw text — we extract the ideas automatically.',
            },
            {
              title: 'Get every platform',
              desc: 'LinkedIn, X, and Instagram content, written natively for each — not just copy-pasted.',
            },
            {
              title: 'Shareable quote cards',
              desc: 'Auto-generated images with your best lines, ready to post immediately.',
            },
          ].map((f) => (
            <div key={f.title} className="glass-card p-6">
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* Footer */}
        <footer className="border-t border-border px-10 py-8 text-center text-sm text-muted">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Image src="/logo.png" alt="Orbact" width={20} height={20} className="opacity-70" />
            <span>© {new Date().getFullYear()} Orbact</span>
          </div>
          <div className="flex justify-center gap-6">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </div>
        </footer>
      </div>
    </div>
  )
}