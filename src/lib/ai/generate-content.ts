import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const SYSTEM_PROMPT = `You are Orbact Repurpose's content engine. Given source content, produce platform-native social media posts that preserve the original ideas but sound natively written for each platform — never like a summary or translation of the source.

Respond with ONLY valid JSON, no markdown code fences, no explanation text before or after. Match exactly this schema:

{
  "linkedin": string,
  "twitter_thread": string[],
  "instagram_caption": string,
  "instagram_hashtags": string[],
  "quote_highlights": string[]
}

Field rules:
- linkedin: 150-300 words, professional but conversational, uses line breaks for readability, ends with a soft question or call-to-action. No hashtags in this field.
- twitter_thread: an array of 5 to 7 strings forming a thread. First tweet is a strong hook under 200 characters that creates curiosity. Each following tweet under 260 characters, one idea per tweet. Do NOT include manual numbering like "1/7" — clients add that automatically.
- instagram_caption: 100-200 words, casual and punchy tone, 1-2 emojis used naturally (not excessive), ends with a call-to-action. No hashtags inside this field — they go in instagram_hashtags separately.
- instagram_hashtags: 8-12 specific, relevant hashtags as lowercase strings WITHOUT the # symbol (e.g. "contentmarketing" not "#contentmarketing"). Avoid generic filler tags like "love" or "instagood".
- quote_highlights: exactly 3 short, standalone, punchy statements under 100 characters each, extracted or distilled from the source — suitable for text-on-image quote cards.`

export type GeneratedContent = {
  linkedin: string
  twitter_thread: string[]
  instagram_caption: string
  instagram_hashtags: string[]
  quote_highlights: string[]
}

export async function generateRepurposedContent(
  title: string,
  sourceText: string
): Promise<GeneratedContent> {
  const completion = await groq.chat.completions.create({
  model: 'openai/gpt-oss-120b',
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Source title: ${title}\n\nSource content:\n${sourceText}`,
    },
  ],
  response_format: { type: 'json_object' },
  temperature: 0.7,
  max_tokens: 1600,
  reasoning_effort: 'low',
  })

  const raw = completion.choices[0]?.message?.content
  if (!raw) throw new Error('Empty response from Groq')

  let parsed: GeneratedContent
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Model returned invalid JSON — try again')
  }

  // Basic shape validation — cheap insurance against a malformed model response
  if (
    !parsed.linkedin ||
    !Array.isArray(parsed.twitter_thread) ||
    !parsed.instagram_caption ||
    !Array.isArray(parsed.instagram_hashtags) ||
    !Array.isArray(parsed.quote_highlights)
  ) {
    throw new Error('Model response missing required fields — try again')
  }

  return parsed
}