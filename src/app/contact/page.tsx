import Link from 'next/link'
import ContactForm from './contact-form'

export const metadata = {
  title: 'Discuss a project | Orbact',
  description: 'Tell Orbact about an automation, AI agent, or custom development project.',
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>
}) {
  const { service } = await searchParams
  const selected = service === 'automation' || service === 'agents' || service === 'development'
    ? service : 'unsure'
  return (
    <main className="min-h-screen max-w-6xl mx-auto px-6 py-10">
      <nav className="flex items-center justify-between mb-20">
        <Link href="/" className="font-bold text-lg">Orbact<span className="text-primary">.</span></Link>
        <Link href="/services" className="text-sm text-muted hover:text-white">Explore services →</Link>
      </nav>
      <div className="grid lg:grid-cols-[0.85fr_1fr] gap-12 items-start">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-5">Start a conversation</p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">Tell us what work should feel easier.</h1>
          <p className="text-lg text-muted mt-7 leading-relaxed">Share the process, bottleneck, or product idea. We’ll review the brief and discuss a practical next step.</p>
          <p className="text-sm text-muted mt-8">Prefer email? <a href="mailto:contact.orbact@gmail.com" className="text-violet-300 hover:underline">contact.orbact@gmail.com</a></p>
        </div>
        <ContactForm initialService={selected} />
      </div>
    </main>
  )
}
