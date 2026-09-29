import Link from 'next/link'
import Image from 'next/image'
import { SERVICES } from '@/lib/services'

const plans = [
  { name: 'Free', price: '$0', detail: 'Try the workflow', credits: '3 total generations', features: ['All four draft formats', 'Editable drafts and exports', 'Saved draft history'], featured: false },
  { name: 'Starter', price: '$19', detail: 'For a steady content rhythm', credits: '30 generations / month', features: ['Everything in Free', 'Credits renew each paid period', 'Manage billing in Stripe'], featured: true },
  { name: 'Pro', price: '$49', detail: 'For higher volume', credits: '150 generations / month', features: ['Everything in Starter', 'More room for campaigns', 'The same review-first workflow'], featured: false },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="gradient-orb orb-violet w-[640px] h-[640px] -top-48 -left-40" />
      <div className="gradient-orb orb-blue w-[560px] h-[560px] top-[450px] -right-60" />
      <div className="relative z-10">
        <header className="border-b border-border/80">
          <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-3 font-semibold text-lg">
              <Image src="/logo.png" alt="" width={32} height={32} />
              <span>Orbact <span className="text-muted font-normal">/ Repurpose</span></span>
            </Link>
            <div className="hidden md:flex items-center gap-7 text-sm text-muted">
              <a href="#how-it-works" className="hover:text-white">How it works</a>
              <a href="#pricing" className="hover:text-white">Pricing</a>
              <Link href="/services" className="hover:text-white">AI services</Link>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Link href="/login" className="text-muted hover:text-white hidden sm:inline">Log in</Link>
              <Link href="/login" className="btn-primary text-sm">Start free</Link>
            </div>
          </nav>
        </header>

        <main>
          <section className="max-w-7xl mx-auto px-6 pt-20 pb-24 lg:pt-28 lg:pb-32 grid lg:grid-cols-[1fr_0.92fr] items-center gap-16">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 text-violet-200 px-4 py-2 text-xs font-medium uppercase tracking-[0.13em] mb-8">
                <span className="w-2 h-2 rounded-full bg-violet-400" /> By Orbact AI Automation
              </div>
              <h1 className="text-5xl sm:text-6xl xl:text-7xl font-bold tracking-[-0.055em] leading-[1.04]">
                One idea. <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-violet-400 to-cyan-300">Many ways</span> to show up.
              </h1>
              <p className="text-lg md:text-xl text-muted max-w-xl mt-7 leading-relaxed">
                Turn a useful article, video transcript, or original text into editable LinkedIn, X, Instagram, and carousel drafts.
              </p>
              <div className="flex flex-wrap gap-3 mt-9">
                <Link href="/login" className="btn-primary inline-flex items-center gap-2">Create your first drafts <span aria-hidden>↗</span></Link>
                <a href="#sample" className="btn-secondary">See an example</a>
              </div>
              <p className="text-xs text-muted mt-5">3 free generations · Review before publishing · No auto-posting</p>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-[36px] bg-gradient-to-br from-violet-500/15 to-cyan-400/10 blur-3xl" />
              <div className="relative rounded-[28px] border border-violet-400/25 bg-[#11111d]/95 shadow-2xl shadow-black/50 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-300/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                  <span className="text-xs text-muted ml-3">orbact / content studio</span>
                </div>
                <div className="p-6 md:p-8">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-5">
                    <p className="text-[11px] uppercase tracking-widest text-violet-300 mb-2">Your source</p>
                    <p className="text-sm text-white">A product update, article, or useful idea from your team</p>
                  </div>
                  <div className="flex justify-center text-violet-300 text-2xl mb-5" aria-hidden>↓</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['LinkedIn', 'A thoughtful post with a clear point of view.'],
                      ['X', 'A focused thread that builds one idea at a time.'],
                      ['Instagram', 'A punchy caption and relevant hashtags.'],
                      ['Carousel', 'A visual sequence with downloadable slides.'],
                    ].map(([title, description]) => (
                      <div key={title} className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-4 min-h-32">
                        <span className="text-xs text-violet-300">{title}</span>
                        <p className="text-sm text-white/85 mt-4 leading-snug">{description}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted mt-5">Edit · Save · Export · Publish when ready</p>
                </div>
              </div>
            </div>
          </section>

          <section id="how-it-works" className="border-y border-border bg-white/[0.015]">
            <div className="max-w-7xl mx-auto px-6 py-20">
              <p className="text-xs uppercase tracking-[0.25em] text-primary mb-4">The workflow</p>
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight max-w-2xl">From source to ready-to-review drafts.</h2>
                <p className="text-muted max-w-sm">Keep the substance of your original content, with writing shaped for each format.</p>
              </div>
              <div className="grid md:grid-cols-3 gap-5">
                {[
                  ['01', 'Bring the source', 'Paste text, an article URL, or a YouTube link with accessible captions.'],
                  ['02', 'Set the direction', 'Choose the audience, voice, offer, CTA, and phrases to avoid.'],
                  ['03', 'Make it yours', 'Edit, save, copy, export, and download carousel slides before publishing.'],
                ].map(([number, title, description]) => (
                  <div key={number} className="glass-card p-7">
                    <span className="text-sm text-violet-300">{number} /</span>
                    <h3 className="text-xl font-semibold mt-7 mb-3">{title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="sample" className="max-w-7xl mx-auto px-6 py-24">
            <div className="grid lg:grid-cols-[0.72fr_1fr] gap-12 items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-primary mb-4">A real workflow, shown simply</p>
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Your thinking stays at the center.</h2>
                <p className="text-muted mt-6 leading-relaxed">Repurpose uses your source as the factual base. It drafts different angles for different places, then leaves the final call with you.</p>
                <p className="text-sm text-muted mt-5">Illustrative example only. Actual output depends on the source and your brief.</p>
              </div>
              <div className="glass-card p-6 md:p-8">
                <div className="border-b border-border pb-5 mb-5">
                  <span className="text-xs uppercase tracking-widest text-violet-300">Example source idea</span>
                  <p className="mt-3 text-sm">“We reduced repetitive reporting by connecting form submissions, CRM updates, and weekly summaries.”</p>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-widest text-cyan-300">Example LinkedIn angle</span>
                  <p className="text-sm text-white/90 mt-3 leading-relaxed">The report was never the hard part. Moving information between tools was.<br /><br />Once submissions, CRM updates, and weekly summaries shared one workflow, the team had fewer handoffs to manage.<br /><br />Where does your reporting process still depend on copying and pasting?</p>
                </div>
              </div>
            </div>
          </section>

          <section id="pricing" className="border-y border-border bg-white/[0.015]">
            <div className="max-w-7xl mx-auto px-6 py-24">
              <div className="text-center mb-12">
                <p className="text-xs uppercase tracking-[0.25em] text-primary mb-4">Simple pricing</p>
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Pick your publishing pace.</h2>
                <p className="text-muted mt-4">One completed generation creates the four draft formats shown above.</p>
              </div>
              <div className="grid md:grid-cols-3 gap-5">
                {plans.map((plan) => (
                  <div key={plan.name} className={'rounded-2xl p-7 flex flex-col border ' + (plan.featured ? 'border-violet-400/60 bg-violet-500/[0.11] shadow-xl shadow-violet-950/20' : 'border-border bg-white/[0.025]')}>
                    <p className="text-sm font-semibold text-violet-300">{plan.name}</p>
                    <p className="text-4xl font-bold mt-4">{plan.price}<span className="text-sm text-muted font-normal">{plan.name === 'Free' ? '' : ' / month'}</span></p>
                    <p className="text-sm text-muted mt-2">{plan.detail}</p>
                    <p className="text-sm font-medium mt-7 pb-5 border-b border-border">{plan.credits}</p>
                    <ul className="space-y-3 text-sm text-muted mt-6 mb-8">
                      {plan.features.map((feature) => <li key={feature}>✓ &nbsp;{feature}</li>)}
                    </ul>
                    <Link href="/login" className={plan.featured ? 'btn-primary text-center mt-auto' : 'btn-secondary text-center mt-auto'}>{plan.name === 'Free' ? 'Start free' : 'Choose ' + plan.name}</Link>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted text-center mt-6">Subscription billing and cancellation are handled through Stripe. Credits reset after a paid renewal.</p>
            </div>
          </section>

          <section className="max-w-7xl mx-auto px-6 py-24">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-primary mb-4">Beyond the product</p>
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Need more than draft creation?</h2>
              </div>
              <Link href="/services" className="text-violet-300 hover:text-white">Explore Orbact services →</Link>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {Object.entries(SERVICES).map(([slug, service]) => (
                <Link href={'/services/' + slug} key={slug} className="glass-card p-7 hover:border-violet-400/50 transition-colors">
                  <h3 className="text-xl font-semibold mb-3">{service.label}</h3>
                  <p className="text-sm text-muted leading-relaxed">{service.description}</p>
                  <span className="block text-sm text-violet-300 mt-6">Learn more →</span>
                </Link>
              ))}
            </div>
          </section>
        </main>

        <footer className="border-t border-border">
          <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5 text-sm text-muted">
            <div className="flex items-center gap-2"><Image src="/logo.png" alt="" width={20} height={20} /> Orbact © {new Date().getFullYear()}</div>
            <div className="flex flex-wrap gap-6">
              <Link href="/services" className="hover:text-white">Services</Link>
              <Link href="/contact" className="hover:text-white">Contact</Link>
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-white">Terms</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
