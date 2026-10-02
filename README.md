# Orbact Repurpose

Orbact Repurpose turns a source article, captioned YouTube video, or pasted text into editable LinkedIn, Facebook Page, X, Instagram, and carousel drafts. It is a focused SaaS product by Orbact, alongside the agency's AI Automation, AI Agents, and AI Development services.

## What is implemented

- Brand brief, grounded generation prompt, schema validation, one correction attempt, and an atomic generation credit with refund on failure.
- Saved drafts, editing, copy, Markdown/JSON export, and downloadable square carousel PNGs.
- Free browser-rendered branded PNGs in square or portrait layouts, with optional Cloudflare Workers AI artwork behind a disabled-by-default switch. The finished image renders editable text over the artwork in the browser.
- Manual content calendar for LinkedIn, X, Instagram, and Facebook.
- An optional managed publishing queue with approval, per-platform status, Instagram JPEG upload, and a Make webhook protected by Make API-key authentication. A dedicated Make scenario is saved in fail-closed mode; each platform's developer permissions and a tested publishing branch are still required before enabling automatic delivery. The manual calendar works without them.
- Supabase authentication, gated Starter/Pro Stripe billing, agency service pages, and inquiry intake.

## Local development

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and populate your own test credentials.
3. Apply `supabase/migrations/202609290001_core.sql` to a **test** Supabase project after reviewing its existing schema. Create the `publishing` public Storage bucket only if enabling managed Instagram publishing.
4. Run `npm run dev`, then `npm test`, `npm run lint`, and `npm run build`. Run `npm run db:check` for the configured database and `npm run ai:check` for one real model response.

See [app release readiness](docs/APP_RELEASE_READINESS.md), [platform setup](docs/PLATFORM_SETUP.md), and [live billing cutover](docs/LIVE_CUTOVER.md). The current Vercel subdomain supports free prototype testing; a custom domain is optional until a later launch decision.

Keep `BILLING_MODE=disabled` for a free launch. Enable paid public access only after the database migration, RLS checks, live Stripe setup, and two-user access tests pass against the deployed environment. Managed publishing remains off by default.
