# Prototype acceptance report — updated October 2, 2026

This report covers the deployed Vercel prototype and its connected free-tier services. Automatic Make publishing, paid checkout, AI-hosted image generation, and public email signup/recovery were intentionally disabled.

## Passed

- Vercel Production deployed and marked Ready for commit `2b18a00`. Public routes loaded. Anonymous generation, calendar, extraction, and publishing cron requests were denied. Paid checkout and the optional AI image endpoint returned unavailable as configured.
- The existing Supabase Free project passed schema and live sandbox checks. Two temporary confirmed users received separate Free profiles with 0/3 credits. RLS prevented reading another user's data or editing billing fields. Duplicate credit reservation did not charge twice; a failed reservation refunded once. Service-only calendar operations worked. Temporary accounts and rows were removed.
- A live Google sign-in for an existing Orbact Google identity returned to the authenticated dashboard. A new Google identity was not separately tested. Existing email login remains available; email signup and recovery controls are hidden while custom SMTP is absent.
- In the live dashboard, pasted source text produced LinkedIn, X, Facebook Page, Instagram, and carousel drafts. Credits changed from 0/3 to 1/3; a saved edit appeared in the library. The sample remained on the founder's account for review.
- A live public article URL, `https://orbact-repurpose.vercel.app/services/automation`, extracted 677 characters after fixing the pinned DNS lookup. A direct local HTTPS extraction also passed. No generation credit was used for the URL test.
- A manual Facebook Page calendar item was created and displayed, then removed after the test. No test item remains planned.
- The Image Studio update deployed in commit `2d736d7` and Vercel marked it Ready. The live app exported square 1080 × 1080 and portrait 1080 × 1350 PNGs, both inspected for legible typography and layout. These were browser-generated without a third-party image API.
- A temporary contact inquiry reached `agency_inquiries` and was removed. Groq showed a Free plan and supplied a real generation response. Upstash showed Free Tier in Frankfurt with usage within its quota.
- Local checks passed: 15 tests, lint, production build, `npm run ai:check`, and the Supabase acceptance script. Recent Vercel logs showed zero errors during the inspected interval.

Repeatable checks live in [`scripts/verify-supabase-acceptance.mjs`](../scripts/verify-supabase-acceptance.mjs) and [`scripts/verify-deployed-smoke.mjs`](../scripts/verify-deployed-smoke.mjs). They mutate only the configured sandbox and require `ACCEPTANCE_ALLOW_TEST_MUTATIONS=yes`.

## Limits and deferred work

- The generated sample initially described a proposed consulting workflow as completed work. The saved draft was corrected, and the prompt now requires hypothetical language and correct attribution for third-party examples. AI copy still needs human review before posting.
- Markdown, JSON, and carousel download files were not inspected in this acceptance pass. Captioned YouTube extraction, real API fault refunds, responsive layout, and a brand-new Google user's first sign-in were not independently verified. Cloudflare AI artwork is coded but remains disabled until a Free account, token, and real provider response are tested.
- Vercel Hobby is being used only for the prototype. Commercial paid launch requires hosting or a plan that permits the intended use. Existing sandbox Stripe links require a deliberate migration and live billing acceptance; paid checkout stays disabled. Custom SMTP is required before enabling email signup and password recovery.
- Make publishing remains deferred and disabled. Its scenario and all social-posting checks are outside this app acceptance pass. X delivery remains manual under the zero-cost policy.
- The founder must review the Privacy Policy and Terms for the operating entity, jurisdiction, retention terms, and support details before inviting external users.

See [`APP_RELEASE_READINESS.md`](APP_RELEASE_READINESS.md) for deployment configuration and [`PLATFORM_SETUP.md`](PLATFORM_SETUP.md) for later external setup.
