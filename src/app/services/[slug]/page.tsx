import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SERVICES, type ServiceSlug } from '@/lib/services'

export function generateStaticParams() {
  return Object.keys(SERVICES).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const service = SERVICES[slug as ServiceSlug]
  return service ? { title: service.label + ' | Orbact', description: service.description } : {}
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!(slug in SERVICES)) notFound()
  const service = SERVICES[slug as ServiceSlug]

  return (
    <main className="min-h-screen max-w-6xl mx-auto px-6 py-10">
      <nav className="flex items-center justify-between mb-20">
        <Link href="/" className="font-bold text-lg">Orbact<span className="text-primary">.</span></Link>
        <Link href="/services" className="text-sm text-muted hover:text-white">All services →</Link>
      </nav>
      <p className="text-xs uppercase tracking-[0.25em] text-primary mb-5">{service.eyebrow}</p>
      <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-4xl">{service.headline}</h1>
      <p className="text-lg text-muted max-w-2xl mt-7 leading-relaxed">{service.description}</p>
      <Link href={'/contact?service=' + slug} className="btn-primary inline-block mt-9">Discuss this service</Link>

      <section className="mt-24">
        <p className="text-xs uppercase tracking-[0.25em] text-primary mb-4">What we build</p>
        <div className="grid md:grid-cols-3 gap-5">
          {service.examples.map(([title, description]) => (
            <article key={title} className="glass-card p-7">
              <h2 className="text-xl font-semibold mb-3">{title}</h2>
              <p className="text-sm text-muted leading-relaxed">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-10 mt-24 pb-24">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-4">The result</p>
          <h2 className="text-3xl font-semibold">Built around useful outcomes.</h2>
        </div>
        <ul className="space-y-4">
          {service.outcomes.map((outcome) => (
            <li key={outcome} className="border-b border-border pb-4 text-muted">↗ &nbsp;{outcome}</li>
          ))}
        </ul>
      </section>
    </main>
  )
}
