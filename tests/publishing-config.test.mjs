import assert from 'node:assert/strict'
import test from 'node:test'
import { makeWebhookUrl, managedPublishingPlatforms, parsePublisherResult } from '../src/lib/publishing-config.ts'

test('managed publishing requires a global switch and an explicit platform allowlist', () => {
  assert.deepEqual([...managedPublishingPlatforms({
    ENABLE_MANAGED_PUBLISHING: 'false',
    MANAGED_PUBLISH_PLATFORMS: 'linkedin,facebook',
  })], [])
  assert.deepEqual([...managedPublishingPlatforms({
    ENABLE_MANAGED_PUBLISHING: 'true',
    MANAGED_PUBLISH_PLATFORMS: 'linkedin, instagram, facebook, unknown',
  })], ['linkedin', 'instagram', 'facebook'])
  assert.equal(managedPublishingPlatforms({ ENABLE_MANAGED_PUBLISHING: 'true' }).has('x'), false)
})

test('a publisher cannot report success without a usable platform post ID', () => {
  assert.deepEqual(parsePublisherResult({ status: 'published', externalId: ' urn:li:share:123 ' }), {
    status: 'published', externalId: 'urn:li:share:123',
  })
  assert.equal(parsePublisherResult({ status: 'published' }), null)
  assert.equal(parsePublisherResult({ status: 'published', externalId: '   ' }), null)
  assert.equal(parsePublisherResult({ status: 'published', externalId: 'x'.repeat(201) }), null)
  assert.deepEqual(parsePublisherResult({ status: 'failed', error: 'Permission denied' }), {
    status: 'failed', error: 'Permission denied',
  })
  assert.equal(parsePublisherResult({ status: 'pending' }), null)
})

test('publisher credentials can only be sent to a Make webhook host', () => {
  assert.equal(makeWebhookUrl('https://hook.us2.make.com/abc123').hostname, 'hook.us2.make.com')
  assert.equal(makeWebhookUrl('https://hook.make.com/abc123').hostname, 'hook.make.com')
  for (const value of [
    'https://hook.make.com.evil.test/abc123',
    'http://hook.us2.make.com/abc123',
    'https://localhost/abc123',
    'https://hook.us2.make.com/',
    'https://hook.us2.make.com/abc123?token=value',
  ]) assert.throws(() => makeWebhookUrl(value))
})
