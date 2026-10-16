import assert from 'node:assert/strict'
import test from 'node:test'
import { POST_DESIGNS, parsePostDesignInput, trustedTemplateImageUrl } from '../src/lib/post-designs.ts'

test('three distinct post designs use independent server-side template IDs', () => {
  assert.equal(POST_DESIGNS.length, 3)
  assert.equal(new Set(POST_DESIGNS.map((design) => design.id)).size, 3)
  assert.equal(new Set(POST_DESIGNS.map((design) => design.env)).size, 3)
})

test('only provider image hosts can be downloaded by the server', () => {
  assert.ok(trustedTemplateImageUrl('https://rest.apitemplate.io/v2/get-image/abc'))
  assert.ok(trustedTemplateImageUrl('https://bucket.s3.amazonaws.com/example.jpeg'))
  assert.equal(trustedTemplateImageUrl('http://rest.apitemplate.io/v2/get-image/abc'), null)
  assert.equal(trustedTemplateImageUrl('https://rest.apitemplate.io.evil.example/file'), null)
  assert.equal(trustedTemplateImageUrl('https://127.0.0.1/file'), null)
})

test('design request accepts short editable copy and rejects invalid input', () => {
  const valid = { design: 'editorial', headline: 'AI without busywork', kicker: 'ORBACT INSIGHT', body: 'Make work move faster.' }
  assert.deepEqual(parsePostDesignInput(valid), { ...valid, artworkUrl: '' })
  assert.equal(parsePostDesignInput({ ...valid, design: 'other' }), null)
  assert.equal(parsePostDesignInput({ ...valid, headline: 'x'.repeat(81) }), null)
  assert.equal(parsePostDesignInput({ ...valid, artworkUrl: 42 }), null)
})
