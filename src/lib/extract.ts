import { parseHTML } from 'linkedom'
import { Readability } from '@mozilla/readability'
import { fetchTranscript } from 'youtube-transcript-plus'
import { assertSafeUrl } from './security/ssrf-guard'

const MAX_INPUT_CHARS = 14000 // hard cap regardless of plan — refined per-plan in Step 6

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

  const { document } = parseHTML(html)
  try {
    ;(document as { baseURI?: string }).baseURI = url.toString()
  } catch {
    // best-effort — relative links may not resolve perfectly without this, but extraction still works
  }
  const reader = new Readability(document as unknown as Document)
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
  let transcript: Awaited<ReturnType<typeof fetchTranscript>>
  try {
    transcript = await fetchTranscript(rawUrl)
  } catch {
    throw new Error(
      "Couldn't extract captions for this video — try pasting the transcript directly using the \"Pasted Text\" option instead."
    )
  }

  if (!transcript.length) {
    throw new Error(
      "This video doesn't have accessible captions — try pasting the transcript directly using the \"Pasted Text\" option instead."
    )
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