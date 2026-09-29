# Prototype acceptance report — September 29, 2026

This report distinguishes checks performed against the deployed sandbox, local checks, and launch work still open. No automatic social publishing or live billing was enabled during these checks.

## Passed

- Local `npm test`, `npm run lint`, and `npm run build` pass. The tests cover renewal period selection, duplicate/proration billing behavior, content validation, URL safety, Make host restrictions, platform allowlisting, and publisher response validation.
- The deployed public pages (`/`, `/login`, `/services`, `/contact`, `/privacy`, `/terms`) returned HTTP 200. Anonymous generation, calendar, extraction, and publishing cron requests were denied with HTTP 401.
- A temporary confirmed sandbox user signed in and generated four draft formats from pasted text. The app recorded one of three free credits and displayed the drafts in history.
- Two temporary sandbox users were isolated by Supabase RLS. Authenticated clients could not edit billing fields or invoke service-only credit/queue functions. A repeated reservation did not charge twice; a failed generation refunded once. Service-only calendar operations succeeded. The temporary users and rows created by the repeatable database test were removed.
- A sandbox contact submission reached the inquiries table; its temporary row was removed.

The repeatable checks live in [`scripts/verify-supabase-acceptance.mjs`](../scripts/verify-supabase-acceptance.mjs) and [`scripts/verify-deployed-smoke.mjs`](../scripts/verify-deployed-smoke.mjs). They mutate only the configured sandbox and require `ACCEPTANCE_ALLOW_TEST_MUTATIONS=yes`.

## Open before a public launch

- Complete email confirmation and password-reset flows with production SMTP; test Google sign-in only if enabled.
- Recheck generation quality against live articles and captioned YouTube videos. A sandbox draft phrased a proposed workflow as completed work; the prompt has been tightened locally, but it needs deployed verification and editorial review. Check extraction failures and credit refunds under real API faults.
- Verify editing, save, export, carousel download, manual calendar, and responsive layouts with a real browser session. The calendar date input was not reliably driven by the browser automation tool, so no end-to-end manual reminder result is claimed yet.
- Keep Stripe in test mode until the separate live cutover is approved and tested. The sandbox webhook, renewal, failure/recovery, duplicate, and event-order checks were completed earlier; this report does not treat those as live billing acceptance.
- Obtain approved social developer accounts, add and test platform branches in the new dedicated Make scenario, connect test social accounts, and verify duplicate handling plus definite/uncertain responses. The scenario is saved with an API-key-protected webhook and a fixed `failed` JSON response, is Inactive, and has no posting modules. A no-key request returned HTTP 401; an authorized request and platform posting were not tested. X's official posting API requires prepaid credits, so automatic all-four-platform delivery conflicts with a zero-cost policy. The current app remains in manual mode for every platform.
- Decide on hosting that permits commercial SaaS use before accepting paying customers. Vercel Hobby is suitable here only for the free prototype. Review the privacy/terms drafts for the operating jurisdiction and data retention policy.

See [`PLATFORM_SETUP.md`](PLATFORM_SETUP.md) for the exact external steps and [`MAKE_PUBLISHING_CONTRACT.md`](MAKE_PUBLISHING_CONTRACT.md) for the publishing request/response contract.
