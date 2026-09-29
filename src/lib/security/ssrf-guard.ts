import dns from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

const blockedIpv4 = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedIpv4.addSubnet(network, prefix, 'ipv4')
}

const globalIpv6 = new BlockList()
globalIpv6.addSubnet('2000::', 3, 'ipv6')

const blockedIpv6 = new BlockList()
blockedIpv6.addSubnet('2001:db8::', 32, 'ipv6')
blockedIpv6.addSubnet('2001:10::', 28, 'ipv6')

export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return !blockedIpv4.check(address, 'ipv4')
  if (family === 6) {
    return globalIpv6.check(address, 'ipv6') && !blockedIpv6.check(address, 'ipv6')
  }
  return false
}

export type SafeUrl = {
  url: URL
  address: string
  family: 4 | 6
}

export async function assertSafeUrl(rawUrl: string): Promise<SafeUrl> {
  if (rawUrl.length > 2048) throw new Error('URL is too long')

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http/https URLs are allowed')
  }
  if (url.username || url.password) {
    throw new Error('URLs with credentials are not allowed')
  }
  if (url.port && !['80', '443'].includes(url.port)) {
    throw new Error('Only standard web ports are allowed')
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('URL not allowed')
  }

  const addresses = await dns.lookup(hostname, { all: true })
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('URL resolves to a blocked address range')
  }

  url.hash = ''
  const selected = addresses[0]
  return { url, address: selected.address, family: selected.family as 4 | 6 }
}
