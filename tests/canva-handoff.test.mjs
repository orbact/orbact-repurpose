import assert from 'node:assert/strict'
import test from 'node:test'
import { canvaSlideCopy } from '../src/lib/canva-handoff.ts'

test('Canva handoff keeps edited page order and only places brand footer on edge pages', () => {
  const copy = canvaSlideCopy({
    linkedin: '', twitter_thread: [], instagram_caption: 'Read the full guide.',
    instagram_hashtags: ['orbact', 'automation'],
    carousel: {
      cover: { headline: 'Opening idea', accent: 'Start here' },
      slides: [{ headline: 'A practical step', accent: '01', body: 'Do the useful work.' }],
      closing: 'Visit Orbact',
    },
  })
  assert.ok(copy.indexOf('Page 1 — Cover') < copy.indexOf('Page 2 — Content'))
  assert.ok(copy.indexOf('Page 2 — Content') < copy.indexOf('Page 3 — Closing'))
  assert.match(copy, /Body: Do the useful work\./)
  assert.match(copy, /first and last pages only/)
  assert.match(copy, /Hashtags: #orbact #automation/)
})
