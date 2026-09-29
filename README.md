# Orbact Repurpose

Orbact Repurpose turns a source article, captioned YouTube video, or pasted text into editable LinkedIn, X, Instagram, and carousel drafts. It is a focused SaaS product by Orbact, alongside the agency's AI Automation, AI Agents, and AI Development services.

## What is implemented

- Brand brief, grounded generation prompt, schema validation, one correction attempt, and an atomic generation credit with refund on failure.
- Saved drafts, editing, copy, Markdown/JSON export, and downloadable square carousel PNGs.
- Manual content calendar for LinkedIn, X, Instagram, and Facebook.
- An optional managed publishing queue with approval, per-platform status, Instagram JPEG upload, and a Make webhook protected by Make API-key authentication. A new Make scenario and each platform's developer permissions must be configured before this mode is enabled. The manual calendar works without them.
- Supabase authentication, Starter/Pro Stripe billing, agency service pages, and inquiry intake.

## Local development

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and populate your own test credentials.
3. Apply `supabase/migrations/202609290001_core.sql` to a **test** Supabase project after reviewing its existing schema. Create the `publishing` public Storage bucket only if enabling managed Instagram publishing.
4. Run `npm run dev`, then `npm run test`, `npm run lint`, and `npm run build`.

See [the full implementation plan](docs/IMPROVEMENT_PLAN.md), [platform setup checklist](docs/PLATFORM_SETUP.md), and [prototype acceptance report](docs/ACCEPTANCE_REPORT.md). The current Vercel subdomain supports free prototype testing; a custom domain is optional until a later launch decision.

Do not enable paid public access until the database migration, RLS checks, Stripe test events, and two-user access tests pass against the deployed environment. Managed publishing remains off by default.
