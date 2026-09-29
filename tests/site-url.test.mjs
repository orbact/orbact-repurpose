import assert from 'node:assert/strict'
import test from 'node:test'
import { getSiteUrl } from '../src/lib/site-url.ts'

test('billing uses a configured HTTPS origin', () => {
  const previousUrl = process.env.APP_URL
  const previousNodeEnv = process.env.NODE_ENV
  try {
    process.env.NODE_ENV = 'production'
    process.env.APP_URL = 'https://app.orbact.example/'
    assert.equal(getSiteUrl(), 'https://app.orbact.example')

    for (const unsafe of [
      'http://app.orbact.example',
      'https://user:pass@app.orbact.example',
      'https://app.orbact.example/path',
      'https://app.orbact.example/?next=elsewhere',
    ]) {
      process.env.APP_URL = unsafe
      assert.throws(() => getSiteUrl(), undefined, unsafe)
    }

    delete process.env.APP_URL
    assert.throws(() => getSiteUrl())
  } finally {
    if (previousUrl === undefined) delete process.env.APP_URL
    else process.env.APP_URL = previousUrl
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnv
  }
})
