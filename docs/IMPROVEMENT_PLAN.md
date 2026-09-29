# Orbact Repurpose improvement plan

Updated 2026-09-29. Product direction: Repurpose is Orbact's focused content drafting SaaS. Orbact's AI Automation, AI Agents, and AI Development services are presented separately, with consultation intake. The product uses a dark technical design and emphasizes measurable time saved through reusable, editable output.

## Phase 0 — secure, billable foundation

**Implemented in code:** guarded article fetching and redirects, request limits and rate limits, trusted billing origin, atomic/idempotent credit reservation and refund, paid-invoice ledger, Stripe subscription reconciliation, RLS and privilege migration, focused tests, and a GitHub Actions test/lint/build workflow. The unused quote-image API is disabled by default.

**External acceptance gate:** apply and test the Supabase migration; test two-user data isolation and direct authenticated-key writes; exercise Stripe checkout, renewal, cancellation, plan change, payment failure, and duplicate events in test mode; test redirected and DNS-changing source URLs in the deployed environment. Do not launch paid access until these pass.

## Phase 1 — useful paid product

**Implemented in code:** clearer landing page and pricing, agency identity, source preview and brand brief, improved generation prompts and output validation, edit/copy/export workspace, saved history, rename/delete, carousel PNG download, email confirmation/reset/sign-out, usage renewal display, better billing feedback, service pages, contact form, legal drafts, and responsive styling.

**External acceptance gate:** verify real email and Google flows; evaluate representative sources with customers; inspect generated facts and platform length limits; visually test dashboard on mobile and keyboard; review legal wording for the business's actual jurisdiction.

## Phase 2 — publishing automation

**Implemented in code:** manual calendar for four platforms; managed queue gated by an environment flag, explicit platform allowlist, and enabled account row; per-post approval, status, cancellation before dispatch, JPEG upload for Instagram, cron claim function, Make API-key-authenticated webhook handoff, and conservative `needs_review` handling for uncertain delivery.

**External integration required:** build a new Make scenario and durable idempotency store; obtain LinkedIn, Facebook, and Instagram publishing permissions and tokens; provision account rows; configure a reliable scheduler; test each enabled branch. X remains manual while the budget is zero because its official write API charges per post. See [platform setup](PLATFORM_SETUP.md) and [Make contract](MAKE_PUBLISHING_CONTRACT.md). Keep `ENABLE_MANAGED_PUBLISHING=false` until this is done. Direct social OAuth connection and self-service reconnection are not implemented; an operator provisions connections.

**Future improvement after pilot feedback:** automatic failure notifications, user-facing account connection/reconnection, operational dashboard, campaign templates, real connected-account analytics, and team approvals. These require additional product and platform work; no screen currently claims they are available.

## Phase 3 — Orbact ecosystem

**Implemented in code:** service pages for AI Automation, AI Agents, and AI Development; a consultation form stored as an `agency_inquiries` record; navigation between agency services and Repurpose.

**External acceptance gate:** assign someone to review inquiries, connect a business email/CRM if notifications are wanted, publish real case studies with permission, and check brand voice and visual assets with the founder.

## Decisions confirmed

- Host: Vercel. Exact domain will be supplied later.
- Pricing: Starter $19/month with 30 credits; Pro $49/month with 150 credits.
- Publishing scope: LinkedIn, X, Instagram, and Facebook, subject to each platform's developer permission and successful test posting.

## Release rule

The repository passes local tests, lint, and production build. That confirms code compilation and focused unit checks, not live account behavior. Finish the external acceptance gates in a test deployment, then repeat the critical payment and publishing checks with production credentials before inviting paying users.
