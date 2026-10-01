import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeSourceUrl, sourceTypeForUrl, youtubeVideoUrl } from '../src/lib/source-url.ts'

test('normalizes supported YouTube watch, short and Shorts URLs', () => {
  const watch = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=20'
  const short = 'https://youtu.be/dQw4w9WgXcQ'
  const shorts = 'https://youtube.com/shorts/dQw4w9WgXcQ'
  for (const input of [watch, short, shorts]) {
    assert.equal(youtubeVideoUrl(input), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    assert.equal(sourceTypeForUrl(input), 'youtube')
  }
})

test('adds HTTPS to ordinary pasted domains without rewriting explicit schemes', () => {
  assert.equal(normalizeSourceUrl(' example.com/article '), 'https://example.com/article')
  assert.equal(normalizeSourceUrl('youtu.be/dQw4w9WgXcQ'), 'https://youtu.be/dQw4w9WgXcQ')
  assert.equal(normalizeSourceUrl('http://example.com/'), 'http://example.com/')
  assert.equal(normalizeSourceUrl('javascript:alert(1)'), 'javascript:alert(1)')
})

test('does not route lookalike or invalid URLs to YouTube extraction', () => {
  for (const input of [
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'http://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=invalid',
    'https://youtube.com@evil.example/watch?v=dQw4w9WgXcQ',
    'https://example.com/article',
  ]) {
    assert.equal(youtubeVideoUrl(input), null)
    assert.equal(sourceTypeForUrl(input), 'url')
  }
})
