import type { GeneratedContent } from './ai/content-schema'

export function canvaSlideCopy(outputs: GeneratedContent): string {
  const pages = [
    `Page 1 — Cover\nHeadline: ${outputs.carousel.cover.headline}\nAccent: ${outputs.carousel.cover.accent}`,
    ...outputs.carousel.slides.map((slide, index) =>
      `Page ${index + 2} — Content\nHeadline: ${slide.headline}\nAccent: ${slide.accent}\nBody: ${slide.body}`),
    ...(outputs.carousel.closing ? [`Page ${outputs.carousel.slides.length + 2} — Closing\nHeadline: ${outputs.carousel.closing}`] : []),
  ]
  return [
    'ORBACT — CANVA DESIGN COPY',
    'Brand: ORBACT · www.orbact.com · #00ECEA on charcoal/white',
    'Replace every sample name, URL, logo, and social handle in the Canva template.',
    'Keep the logo/ORBACT in the top safe area. Show www.orbact.com and social icons on the first and last pages only.',
    'Add or remove Canva pages to match the copy below. Check spacing and contrast before export.',
    ...pages,
    `Caption: ${outputs.instagram_caption}`,
    `Hashtags: ${outputs.instagram_hashtags.map((tag) => `#${tag}`).join(' ')}`,
  ].join('\n\n')
}
