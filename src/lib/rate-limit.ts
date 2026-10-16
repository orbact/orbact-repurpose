import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// A single free Redis database can serve Preview and Production without
// sharing counters across deployments.
const environment = (process.env.VERCEL_ENV ?? process.env.CONTEXT ?? process.env.NODE_ENV ?? 'development')
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, '')
  .slice(0, 32)
const prefix = `orbact:${environment}:ratelimit`

// 10 requests per minute per user — generous enough for real use,
// tight enough to stop scripted abuse
export const extractRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: `${prefix}:extract`,
})

export const quoteImageRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 d'),
  prefix: `${prefix}:quote-image`,
  // Keep Redis authoritative if an image attempt needs an operator reset.
  ephemeralCache: false,
})

// shortcut: shared rolling quota protects the provider's 50-render free plan; sync provider usage before customer V2.
export const postDesignRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(45, '30 d'),
  prefix: `${prefix}:post-design`,
  ephemeralCache: false,
})

export const publishingMediaRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 d'),
  prefix: `${prefix}:publishing-media`,
  ephemeralCache: false,
})

// Tighter — checkout/portal spam is a different risk profile (Stripe API abuse)
export const billingRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: `${prefix}:billing`,
})
export const generateRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: `${prefix}:generate`,
})

export const contactRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: `${prefix}:contact`,
})
