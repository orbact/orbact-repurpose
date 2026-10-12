import assert from 'node:assert/strict'
import test from 'node:test'
import { CANVA_INSTAGRAM_TEMPLATES } from '../src/lib/canva-templates.ts'

test('three distinct Canva Instagram templates link to their verified public pages', () => {
  assert.equal(CANVA_INSTAGRAM_TEMPLATES.length, 3)
  assert.equal(new Set(CANVA_INSTAGRAM_TEMPLATES.map((template) => template.id)).size, 3)
  for (const template of CANVA_INSTAGRAM_TEMPLATES) {
    const url = new URL(template.url)
    assert.equal(url.hostname, 'www.canva.com')
    assert.ok(url.pathname.startsWith(`/templates/${template.id}-`))
  }
})
