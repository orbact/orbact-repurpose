import assert from 'node:assert/strict'
import test from 'node:test'
import { parseGeneratedContent, parseGenerationBrief } from '../src/lib/ai/content-schema.ts'

const valid = {
  linkedin: 'A useful business lesson from the source.',
  twitter_thread: ['One useful idea', 'Another useful idea', 'A practical takeaway'],
  instagram_caption: 'Here is a concise takeaway.',
  instagram_hashtags: ['automation', 'contentstrategy', 'smallbusiness'],
  carousel: {
    cover: { headline: 'Work smarter', accent: 'today' },
    slides: [
      { headline: 'First step', accent: '', body: 'Start with one task.' },
      { headline: 'Second step', accent: '', body: 'Measure the result.' },
    ],
    closing: 'Choose one task to automate this week.',
  },
}

test('accepts a complete output and removes literal Markdown emphasis', () => {
  const result = parseGeneratedContent({
    ...valid,
    carousel: { ...valid.carousel, slides: [
      { ...valid.carousel.slides[0], body: 'Start with **one** task.' },
      valid.carousel.slides[1],
    ] },
  })
  assert.equal(result?.carousel.slides[0].body, 'Start with one task.')
})

test('rejects oversized posts and malformed brief fields', () => {
  assert.equal(parseGeneratedContent({
    ...valid, twitter_thread: ['a'.repeat(281), 'short', 'short'],
  }), null)
  assert.equal(parseGenerationBrief({
    audience: '', tone: 'unapproved', offer: '', cta: '', bannedClaims: '',
  }), null)
})
