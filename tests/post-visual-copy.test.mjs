import assert from 'node:assert/strict'
import test from 'node:test'
import { postVisualCopy } from '../src/lib/post-visual-copy.ts'

test('post visual derives editable design copy from generated source content', () => {
  const copy = postVisualCopy({
    linkedin: '', twitter_thread: [], instagram_caption: '', instagram_hashtags: [],
    image_prompt: 'A blue circuit pattern without words',
    carousel: {
      cover: { headline: 'Automate the follow-up', accent: 'Lead operations' },
      slides: [{ headline: 'First step', accent: '01', body: 'Send the lead to the right team.' }],
    },
  })
  assert.equal(copy.headline, 'Automate the follow-up')
  assert.equal(copy.kicker, 'Lead operations')
  assert.equal(copy.body, 'Send the lead to the right team.')
  assert.equal(copy.prompt, 'A blue circuit pattern without words')
})
