import http from 'node:http'
import https from 'node:https'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'
import { parseHTML } from 'linkedom'
import { Readability } from '@mozilla/readability'
import { fetchTranscript } from 'youtube-transcript-plus'
import { assertSafeUrl, type SafeUrl } from './security/ssrf-guard.ts'
import { youtubeVideoUrl } from './source-url.ts'

export const MAX_INPUT_CHARS = 14000
const MAX_HTML_BYTES = 2_000_000
const MAX_REDIRECTS = 3

export type ExtractResult = {
  title: string
  text: string
  sourceType: 'url' | 'text' | 'youtube'
}

type FetchResult = { html: string } | { redirect: string }

function requestHtml(target: SafeUrl): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    const transport = target.url.protocol === 'https:' ? https : http
    const request = transport.get(
      target.url,
      {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Encoding': 'gzip, deflate, br, identity',
          'User-Agent': 'Mozilla/5.0 (compatible; OrbactRepurposeBot/1.0)',
        },
        // Use the address that passed validation, preventing a second DNS
        // lookup from connecting to a different address.
        lookup: (_hostname, options, callback) => {
          if (options.all) {
            callback(null, [{ address: target.address, family: target.family }])
          } else {
            callback(null, target.address, target.family)
          }
        },
      },
      (response) => {
        const status = response.statusCode ?? 0
        if (status >= 300 && status < 400) {
          const location = response.headers.location
          response.resume()
          if (!location) reject(new Error('Redirect has no destination'))
          else resolve({ redirect: location })
          return
        }
        if (status < 200 || status >= 300) {
          response.resume()
          reject(new Error('Failed to fetch URL (status ' + status + ')'))
          return
        }

        const contentType = response.headers['content-type'] ?? ''
        if (!/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(contentType)) {
          response.resume()
          reject(new Error('URL did not return an HTML page'))
          return
        }
        const encoding = (response.headers['content-encoding'] ?? 'identity').toLowerCase().trim()
        if (!['identity', 'gzip', 'deflate', 'br'].includes(encoding)) {
          response.resume()
          reject(new Error('Page uses an unsupported compression format'))
          return
        }

        const declaredLength = Number(response.headers['content-length'])
        if (Number.isFinite(declaredLength) && declaredLength > MAX_HTML_BYTES) {
          response.resume()
          reject(new Error('Page is too large to process'))
          return
        }

        const chunks: Buffer[] = []
        let bytes = 0
        const decoder = encoding === 'gzip' ? createGunzip()
          : encoding === 'deflate' ? createInflate()
            : encoding === 'br' ? createBrotliDecompress() : null
        const content = decoder ? response.pipe(decoder) : response
        let wireBytes = 0
        response.on('data', (chunk: Buffer) => {
          wireBytes += chunk.length
          if (wireBytes > MAX_HTML_BYTES) response.destroy(new Error('Page is too large to process'))
        })
        content.on('data', (chunk: Buffer) => {
          bytes += chunk.length
          if (bytes > MAX_HTML_BYTES) {
            content.destroy(new Error('Page is too large to process'))
            response.destroy()
            return
          }
          chunks.push(chunk)
        })
        content.on('end', () => {
          const charset = /charset\s*=\s*([\w-]+)/i.exec(contentType)?.[1] || 'utf-8'
          let textDecoder: TextDecoder
          try { textDecoder = new TextDecoder(charset) } catch { textDecoder = new TextDecoder('utf-8') }
          resolve({ html: textDecoder.decode(Buffer.concat(chunks)) })
        })
        content.on('error', reject)
        response.on('error', reject)
      }
    )

    request.setTimeout(10_000, () => request.destroy(new Error('URL request timed out')))
    request.on('error', reject)
  })
}

async function fetchSafeHtml(rawUrl: string): Promise<{ html: string; url: URL }> {
  let currentUrl = rawUrl.trim()
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const target = await assertSafeUrl(currentUrl)
    const result = await requestHtml(target)
    if ('html' in result) return { html: result.html, url: target.url }
    currentUrl = new URL(result.redirect, target.url).toString()
  }
  throw new Error('URL redirected too many times')
}

export async function extractFromUrl(rawUrl: string): Promise<ExtractResult> {
  const { html, url } = await fetchSafeHtml(rawUrl)
  const { document } = parseHTML(html)
  try {
    ;(document as { baseURI?: string }).baseURI = url.toString()
  } catch {
    // Relative links may not resolve perfectly; article text can still be extracted.
  }
  const reader = new Readability(document as unknown as Document)
  const article = reader.parse()

  if (!article || !article.textContent?.trim()) {
    throw new Error('Could not extract readable content from this URL')
  }
  if (article.textContent.trim().length < 50) {
    throw new Error('This page has too little readable text. Paste a longer excerpt instead.')
  }

  return {
    title: (article.title || 'Untitled').slice(0, 200),
    text: article.textContent.trim().slice(0, MAX_INPUT_CHARS),
    sourceType: 'url',
  }
}

export async function extractFromYoutube(rawUrl: string): Promise<ExtractResult> {
  const videoUrl = youtubeVideoUrl(rawUrl)
  if (!videoUrl) {
    throw new Error('Enter a valid YouTube video URL')
  }
  let transcript: Awaited<ReturnType<typeof fetchTranscript>>
  try {
    transcript = await fetchTranscript(videoUrl)
  } catch {
    throw new Error(
      'Could not extract captions for this video. Paste the transcript using Pasted Text instead.'
    )
  }

  if (!transcript.length) {
    throw new Error(
      'This video has no accessible captions. Paste the transcript using Pasted Text instead.'
    )
  }
  const text = transcript.map((item) => item.text).join(' ')
  if (text.trim().length < 50) {
    throw new Error('These captions are too short. Paste a longer transcript instead.')
  }

  return {
    title: 'YouTube Video',
    text: text.trim().slice(0, MAX_INPUT_CHARS),
    sourceType: 'youtube',
  }
}

export function extractFromText(raw: string): ExtractResult {
  const trimmed = raw.trim()
  if (trimmed.length < 50) {
    throw new Error('Text is too short to repurpose (minimum 50 characters)')
  }
  return {
    title: 'Pasted Text',
    text: trimmed.slice(0, MAX_INPUT_CHARS),
    sourceType: 'text',
  }
}
