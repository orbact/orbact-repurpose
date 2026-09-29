export function getSiteUrl(): string {
  const configured = process.env.APP_URL

  if (!configured) {
    if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000'
    throw new Error('APP_URL must be configured for billing redirects')
  }

  let url: URL
  try {
    url = new URL(configured)
  } catch {
    throw new Error('APP_URL must be a valid absolute URL')
  }

  if (
    (url.protocol !== 'https:' && (process.env.NODE_ENV === 'production' || url.protocol !== 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('APP_URL must be a clean HTTPS origin')
  }

  return url.origin
}
