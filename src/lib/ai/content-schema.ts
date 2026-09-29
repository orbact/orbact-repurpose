export type CarouselSlideContent = {
  headline: string
  accent: string
  body: string
}

export type GeneratedContent = {
  linkedin: string
  twitter_thread: string[]
  instagram_caption: string
  instagram_hashtags: string[]
  carousel: {
    cover: { headline: string; accent: string }
    slides: CarouselSlideContent[]
    closing?: string
  }
}

export type GenerationBrief = {
  audience: string
  tone: 'clear' | 'bold' | 'warm' | 'technical'
  offer: string
  cta: string
  bannedClaims: string
}

export function parseGenerationBrief(value: unknown): GenerationBrief | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const audience = typeof record.audience === 'string' ? record.audience.trim() : ''
  const tone = record.tone
  const offer = typeof record.offer === 'string' ? record.offer.trim() : ''
  const cta = typeof record.cta === 'string' ? record.cta.trim() : ''
  const bannedClaims = typeof record.bannedClaims === 'string' ? record.bannedClaims.trim() : ''
  if (audience.length > 160 || offer.length > 200 || cta.length > 200 ||
      bannedClaims.length > 300 ||
      (tone !== 'clear' && tone !== 'bold' && tone !== 'warm' && tone !== 'technical')) return null
  return { audience, tone, offer, cta, bannedClaims }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim().replace(/\*\*/g, '')
  return text && text.length <= max ? text : null
}

export function parseGeneratedContent(value: unknown): GeneratedContent | null {
  const data = record(value)
  const linkedin = clean(data?.linkedin, 5000)
  const instagramCaption = clean(data?.instagram_caption, 2200)
  if (!linkedin || !instagramCaption) return null

  if (!Array.isArray(data?.twitter_thread) ||
      data.twitter_thread.length < 3 || data.twitter_thread.length > 8) return null
  const twitterThread = data.twitter_thread.map((item) => clean(item, 280))
  if (twitterThread.some((item) => item === null)) return null

  if (!Array.isArray(data?.instagram_hashtags) ||
      data.instagram_hashtags.length < 3 || data.instagram_hashtags.length > 30) return null
  const hashtags = data.instagram_hashtags.map((item) =>
    typeof item === 'string' ? item.trim().replace(/^#/, '').toLowerCase() : ''
  )
  if (hashtags.some((tag) => !/^[\p{L}\p{N}_]{2,40}$/u.test(tag))) return null

  const carousel = record(data?.carousel)
  const cover = record(carousel?.cover)
  const coverHeadline = clean(cover?.headline, 80)
  const coverAccent = typeof cover?.accent === 'string' ? cover.accent.trim() : ''
  if (!coverHeadline || coverAccent.length > 40 || !Array.isArray(carousel?.slides) ||
      carousel.slides.length < 2 || carousel.slides.length > 5) return null
  const slides = carousel.slides.map((item) => {
    const slide = record(item)
    const headline = clean(slide?.headline, 80)
    const body = clean(slide?.body, 300)
    const accent = typeof slide?.accent === 'string' ? slide.accent.trim() : ''
    return headline && body && accent.length <= 40 ? { headline, accent, body } : null
  })
  if (slides.some((slide) => slide === null)) return null

  const closing = carousel?.closing === undefined ? undefined : clean(carousel.closing, 160)
  if (closing === null) return null
  return {
    linkedin,
    twitter_thread: twitterThread as string[],
    instagram_caption: instagramCaption,
    instagram_hashtags: hashtags,
    carousel: {
      cover: { headline: coverHeadline, accent: coverAccent },
      slides: slides as CarouselSlideContent[],
      ...(closing ? { closing } : {}),
    },
  }
}
