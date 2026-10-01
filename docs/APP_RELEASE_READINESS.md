# App release readiness (Make publishing deferred)

This is the release path for **the app itself**. Automatic posting through Make is a later phase. Keep `ENABLE_MANAGED_PUBLISHING=false`, `MANAGED_PUBLISH_PLATFORMS=` and the publishing cron off. Users can create drafts, download visuals, and keep manual plans without Make.

## What is complete in the code

- Safe public article URL handling (including compressed HTML), YouTube URL detection and caption fallback guidance, and pasted text extraction.
- Source-grounded Groq generation of LinkedIn, Facebook Page, X, Instagram, carousel, and optional visual prompts. Generation credits are reserved and refunded by database functions on a failed attempt.
- Draft history, editing, export, manual calendar, branded JPEG and carousel PNG downloads. The optional AI image endpoint is authenticated, rate limited, size limited, and disabled unless deliberately configured.
- Billing modes: `BILLING_MODE=disabled` by default hides paid checkout. `test` shows a test-payment notice; `live` is for verified live credentials and a commercial launch. A missing or mismatched key disables paid checkout rather than exposing an incomplete payment flow.
- Google sign-in is enabled for the configured Orbact Supabase project. Email signup and reset links are hidden unless `ENABLE_EMAIL_SIGNUP=true` and `ENABLE_EMAIL_RECOVERY=true` after SMTP testing. Existing email accounts can still sign in.

## Required before a public free launch

**Deployment status on October 1, 2026:** Vercel Production still serves Git commit `e1b1d7e` from September 29. The six new Production settings have been saved in Vercel but apply only to a new deployment: `BILLING_MODE=disabled`, `ENABLE_GOOGLE_AUTH=true`, `ENABLE_EMAIL_SIGNUP=false`, `ENABLE_EMAIL_RECOVERY=false`, `ENABLE_QUOTE_IMAGES=false`, and `ENABLE_MANAGED_PUBLISHING=false`. Publish this release candidate and confirm the deployment commit changes before treating any new behavior as live.

1. **Supabase:** The founder chose to use the existing `orbact-repurpose` project, which has five existing accounts and one sandbox billing link. Its schema and profile trigger passed read-only checks, and its Site URL and exact callback URLs already match `https://orbact-repurpose.vercel.app`. Keep the existing project URL, publishable key, and server-only secret in the deployed app. Recheck `npm run db:check` after any migration. Do not replace its Stripe sandbox credentials with live credentials while old sandbox customer IDs remain in profiles.
2. **Authentication:** The existing project has Google enabled and custom SMTP off. Use Google sign-in for new users at zero cost. The app keeps email login for existing accounts but hides email signup and reset links by default. To offer public email signup later, configure custom SMTP, test delivery to addresses outside the Supabase organization, then set `ENABLE_EMAIL_SIGNUP=true` and `ENABLE_EMAIL_RECOVERY=true`. Supabase's default sender is restricted to project team addresses.
3. **AI and limits:** Set `GROQ_API_KEY`, optional `GROQ_MODEL`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` as server-only variables. Run `npm run ai:check` once against the production Groq organization and test one real article, one captioned video, and pasted text. Confirm credits increase only for completed generations. Monitor free-tier quotas; a free tier cannot guarantee unlimited public traffic.
4. **Image creation:** The no-cost branded JPEG and carousel PNG downloads work in the browser without an image API. Leave `ENABLE_QUOTE_IMAGES=false` unless a Pollinations key and its available quota are verified. If enabling it, set `POLLINATIONS_API_KEY`, generate and download an image using a non-sensitive prompt, and check the response is a usable image. The image provider is optional for the free launch.
5. **Origin and hosting:** Set `APP_URL` to the exact HTTPS production origin. Update Supabase redirects when the domain changes. Deploy this code to a host whose terms permit the intended use. The current Vercel Hobby deployment is a free prototype; [Vercel's Hobby terms](https://vercel.com/docs/plans/hobby) restrict commercial use. A paid SaaS launch requires an eligible host or plan.
6. **Billing:** For a free launch use `BILLING_MODE=disabled`. Existing sandbox-linked accounts remain in this reused database; preserve their records and allow their existing billing portal access, but do not offer new paid checkout. Paid Starter ($19/30 credits) and Pro ($49/150 credits) need a deliberate migration of sandbox profiles and verified live Stripe resources before setting `BILLING_MODE=live`. Test mode uses `BILLING_MODE=test` with sandbox keys and prices.
7. **Founder review:** Review the displayed Privacy Policy and Terms for the real operating entity, region, processors, data retention, and support contact before inviting users. Check the agency inquiry inbox in `agency_inquiries`; the app stores inquiries but does not email them.

## Production smoke sequence

1. Run `npm ci`, `npm test`, `npm run lint`, `npm run build`, and `npm run db:check` for the target environment.
2. Create two **new Google** users. Confirm each sees only their own profile, drafts, and manual calendar. Try to update `plan` and `generations_limit` using an authenticated Supabase client; RLS must deny it.
3. With one account, save a brand brief, extract a public article, generate once, edit and save a draft, export Markdown and JSON, download a carousel PNG and branded JPEG, and add/mark a manual calendar entry. Repeat extraction with pasted text and a captioned YouTube video.
4. Confirm a failed AI request refunds its credit. Retry the same request ID after a network interruption; it must return the prior result or pending state without a second charge.
5. Submit an agency inquiry, verify it appears in `agency_inquiries`, and confirm the founder can review it. Check mobile layout, Google sign-in, sign-out, and the production function logs. Check confirmation and reset emails only after custom SMTP is enabled.
6. Confirm checkout returns unavailable while `BILLING_MODE=disabled` and no automatic publishing option appears. Leave Make for the later phase.

**Current external blockers:** this code is not yet deployed with `BILLING_MODE=disabled`; the existing project contains a sandbox subscription; custom SMTP is absent for email signup; and the current Vercel Hobby host is limited to non-commercial use. The code checks do not certify those external launch conditions.
