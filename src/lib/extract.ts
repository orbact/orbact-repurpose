import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import { YoutubeTranscript } from 'youtube-transcript'
import { assertSafeUrl } from './security/ssrf-guard'

const MAX_INPUT_CHARS = 40000 // hard cap regardless of plan — refined per-plan in Step 6

export type ExtractResult = {
  title: string
  text: string
  sourceType: 'url' | 'text' | 'youtube'
}

export async function extractFromUrl(rawUrl: string): Promise<ExtractResult> {
  const url = await assertSafeUrl(rawUrl)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout — prevents a slow/hanging site from tying up your serverless function

  let html: string
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OrbactRepurposeBot/1.0)' },
    })
    if (!res.ok) throw new Error(`Failed to fetch URL (status ${res.status})`)
    html = await res.text()
  } finally {
    clearTimeout(timeout)
  }

  const dom = new JSDOM(html, { url: url.toString() })
  const reader = new Readability(dom.window.document)
  const article = reader.parse()

  if (!article || !article.textContent?.trim()) {
    throw new Error('Could not extract readable content from this URL')
  }

  return {
    title: article.title || 'Untitled',
    text: article.textContent.trim().slice(0, MAX_INPUT_CHARS),
    sourceType: 'url',
  }
}

export async function extractFromYoutube(rawUrl: string): Promise<ExtractResult> {
  const transcript = await YoutubeTranscript.fetchTranscript(rawUrl)
  if (!transcript.length) {
    throw new Error('No transcript/captions available for this video')
  }
  const text = transcript.map((t) => t.text).join(' ')

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