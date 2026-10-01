import env from '@next/env'

env.loadEnvConfig(process.cwd())
if (!process.env.GROQ_API_KEY) {
  console.error('GROQ_API_KEY is missing.')
  process.exit(1)
}

const { generateRepurposedContent } = await import('../src/lib/ai/generate-content.ts')
const output = await generateRepurposedContent(
  'Proposed lead intake workflow',
  'A small consulting team currently copies website inquiries into a spreadsheet and sends follow-up emails by hand. They are considering a workflow that would capture each submitted form, add a CRM contact, and prepare a follow-up draft for review. They have not launched this workflow and have no measured results. The team wants to understand whether the change would reduce manual copying without losing the human review step.',
  { audience: 'consulting founders', tone: 'clear', offer: '', cta: '', bannedClaims: 'Do not imply the workflow is live or has proven results.' }
)

if (!output.linkedin || !output.facebook_post || output.twitter_thread.length < 3 || !output.instagram_caption ||
    !output.carousel.cover.headline || !output.image_prompt) {
  throw new Error('Generation returned incomplete content')
}
console.log('OK: Groq returned validated LinkedIn, Facebook, X, Instagram, carousel, and image prompt fields.')
