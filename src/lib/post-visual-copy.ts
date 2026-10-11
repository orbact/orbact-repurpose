import type { GeneratedContent } from './ai/content-schema'

export function postVisualCopy(outputs: GeneratedContent) {
  return {
    headline: outputs.carousel.cover.headline,
    kicker: outputs.carousel.cover.accent,
    body: outputs.carousel.slides[0]?.body?.slice(0, 110).trim() || '',
    prompt: outputs.image_prompt || `Abstract editorial illustration about ${outputs.carousel.cover.headline}. Charcoal backdrop, cyan and deep blue light, clean negative space, no text or logos.`,
  }
}
