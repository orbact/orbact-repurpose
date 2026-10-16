export const POST_DESIGNS = [
  { id: 'editorial', name: 'Editorial statement', detail: 'Oversized white type on charcoal with a cyan accent', env: 'APITEMPLATE_EDITORIAL_ID' },
  { id: 'services', name: 'Service focus', detail: 'Clear hierarchy for an offer, insight, or practical step', env: 'APITEMPLATE_SERVICES_ID' },
  { id: 'technology', name: 'Technology image', detail: 'Source-aware artwork behind a concise message', env: 'APITEMPLATE_TECHNOLOGY_ID' },
] as const

export type PostDesignId = typeof POST_DESIGNS[number]['id']

export function trustedTemplateImageUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return url.protocol === 'https:' && !url.username && !url.password && (
      host === 'apitemplate.io' || host.endsWith('.apitemplate.io') ||
      (host.endsWith('.amazonaws.com') && (host.startsWith('s3.') || host.includes('.s3.')))
    ) ? url : null
  } catch { return null }
}

export function parsePostDesignInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  if (!POST_DESIGNS.some((design) => design.id === data.design)) return null
  const headline = typeof data.headline === 'string' ? data.headline.trim() : ''
  const kicker = typeof data.kicker === 'string' ? data.kicker.trim() : ''
  const body = typeof data.body === 'string' ? data.body.trim() : ''
  if (data.artworkUrl !== undefined && typeof data.artworkUrl !== 'string') return null
  const artworkUrl = typeof data.artworkUrl === 'string' ? data.artworkUrl.trim() : ''
  if (!headline || headline.length > 80 || kicker.length > 40 || body.length > 160 || artworkUrl.length > 500) return null
  return { design: data.design as PostDesignId, headline, kicker, body, artworkUrl }
}
