export type PublishingPlatform = 'linkedin' | 'x' | 'instagram' | 'facebook'

const validPlatforms = new Set<PublishingPlatform>(['linkedin', 'x', 'instagram', 'facebook'])

export function managedPublishingPlatforms(environment: NodeJS.ProcessEnv = process.env): Set<PublishingPlatform> {
  if (environment.ENABLE_MANAGED_PUBLISHING !== 'true') return new Set()

  return new Set(
    (environment.MANAGED_PUBLISH_PLATFORMS ?? '')
      .split(',')
      .map((platform) => platform.trim().toLowerCase())
      .filter((platform): platform is PublishingPlatform => validPlatforms.has(platform as PublishingPlatform))
  )
}

export function makeWebhookUrl(value: string): URL {
  const url = new URL(value)
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.search || url.hash || url.pathname === '/' ||
      !(host === 'hook.make.com' || /^hook\.[a-z0-9-]+\.make\.com$/.test(host))) {
    throw new Error('Publishing webhook must be a Make HTTPS webhook URL')
  }
  return url
}

export function parsePublisherResult(value: unknown):
  | { status: 'published'; externalId: string }
  | { status: 'failed'; error: string }
  | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = value as Record<string, unknown>
  if (result.status === 'published') {
    const externalId = typeof result.externalId === 'string' ? result.externalId.trim() : ''
    return externalId && externalId.length <= 200 ? { status: 'published', externalId } : null
  }
  if (result.status === 'failed') {
    const error = typeof result.error === 'string' ? result.error.trim() : ''
    return { status: 'failed', error: (error || 'Platform rejected the post').slice(0, 300) }
  }
  return null
}
