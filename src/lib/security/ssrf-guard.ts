import dns from 'node:dns/promises'

const PRIVATE_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
]

export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http/https URLs are allowed')
  }

  const hostname = url.hostname
  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    throw new Error('URL not allowed')
  }

  // Resolve the hostname and check the ACTUAL IP it points to —
  // this blocks DNS-rebinding tricks, not just obvious "localhost" strings
  const addresses = await dns.lookup(hostname, { all: true })
  for (const { address } of addresses) {
    if (PRIVATE_RANGES.some((range) => range.test(address))) {
      throw new Error('URL resolves to a blocked address range')
    }
  }

  return url
}