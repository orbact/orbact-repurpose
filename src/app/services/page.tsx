import Link from 'next/link'
import { SERVICES } from '@/lib/services'

export const metadata = {
  title: 'AI Services | Orbact',
  description: 'AI automation, conversational agents, and custom AI development for ambitious teams.',
}

export default function ServicesPage() {
  return (
    <main className="min-h-screen max-w-6xl mx-auto px-6 py-10">
      <nav className="flex items-center justify-between mb-24">
        <Link href="/" className="font-bold text-lg">Orbact<span className="text-primary">.</span></Link>
        <Link href="/login" className="text-sm text-muted hover:text-white">Open Repurpose →</Link>
      </nav>
      <p className="text-xs uppercase tracking-[0.25em] text-primary mb-5">Orbact services</p>
      <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl">AI that changes the way work gets done.</h1>
      <p className="text-lg text-muted max-w-2xl mt-7">We turn repetitive work and scattered information into practical systems your team can use every day.</p>
      <div className="grid md:grid-cols-3 gap-5 mt-16">
        {Object.entries(SERVICES).map(([slug, service], index) => (
          <Link href={'/services/' + slug} key={slug} className="glass-card p-7 min-h-72 flex flex-col hover:border-violet-400/50 transition-colors">
            <span className="text-xs text-primary mb-10">0{index + 1} / {service.eyebrow}</span>
            <h2 className="text-2xl font-semibold mb-4">{service.label}</h2>
            <p className="text-sm text-muted leading-relaxed">{service.description}</p>
            <span className="text-sm text-violet-300 mt-auto pt-8">Explore service →</span>
          </Link>
        ))}
      </div>
      <div className="glass-card p-8 md:p-12 mt-16 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h2 className="text-2xl font-semibold">Have a workflow in mind?</h2>
          <p className="text-muted mt-2">Tell us what your team spends time on and what a better process would look like.</p>
        </div>
        <Link href="/contact" className="btn-primary text-center">Discuss a project</Link>
      </div>
    </main>
  )
}
