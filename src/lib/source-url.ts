const YOUTUBE_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be',
])

export function normalizeSourceUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  return /^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(trimmed)
    ? `https://${trimmed}`
    : trimmed
}

export function youtubeVideoUrl(rawUrl: string): string | null {
  let url: URL
  try { url = new URL(normalizeSourceUrl(rawUrl)) } catch { return null }
  if (url.protocol !== 'https:' || !YOUTUBE_HOSTS.has(url.hostname.toLowerCase()) ||
      url.username || url.password || url.port) return null

  const parts = url.pathname.split('/').filter(Boolean)
  const id = url.hostname.toLowerCase() === 'youtu.be'
    ? (parts.length === 1 ? parts[0] : null)
    : parts[0] === 'watch'
      ? url.searchParams.get('v')
      : (['shorts', 'live', 'embed'].includes(parts[0]) && parts.length === 2 ? parts[1] : null)
  return id && /^[A-Za-z0-9_-]{11}$/.test(id)
    ? `https://www.youtube.com/watch?v=${id}`
    : null
}

export function sourceTypeForUrl(rawUrl: string): 'youtube' | 'url' {
  return youtubeVideoUrl(rawUrl) ? 'youtube' : 'url'
}
