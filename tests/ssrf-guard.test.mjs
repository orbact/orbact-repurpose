import assert from 'node:assert/strict'
import test from 'node:test'
import { assertSafeUrl, isPublicAddress } from '../src/lib/security/ssrf-guard.ts'

test('blocks local, special, and mapped IP addresses', () => {
  for (const address of [
    '127.0.0.1',
    '10.2.3.4',
    '169.254.169.254',
    '192.168.1.1',
    '100.64.0.1',
    '198.51.100.5',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '2001:db8::1',
  ]) {
    assert.equal(isPublicAddress(address), false, address)
  }
  assert.equal(isPublicAddress('8.8.8.8'), true)
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true)
})

test('rejects unsafe URL forms before fetching', async () => {
  for (const url of [
    'file:///etc/passwd',
    'http://localhost/',
    'http://127.0.0.1/',
    'http://0x7f000001/',
    'http://[::1]/',
    'https://user:password@example.com/',
    'https://example.com:8443/',
  ]) {
    await assert.rejects(assertSafeUrl(url), undefined, url)
  }
})
