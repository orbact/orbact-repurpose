# App release readiness (Make publishing deferred)

This is the release path for **the app itself**. Automatic posting through Make is a later phase. Keep `ENABLE_MANAGED_PUBLISHING=false`, `MANAGED_PUBLISH_PLATFORMS=` and the publishing cron off. Users can create drafts, download visuals, and keep manual plans without Make.

## What is complete in the code

- Safe public article URL handling (including compressed HTML), YouTube URL detection and caption fallback guidance, and pasted text extraction.
- Source-grounded Groq generation of LinkedIn, Facebook Page, X, Instagram, carousel, and optional visual prompts. Generation credits are reserved and refunded by database functions on a failed attempt.
- Draft history, editing, export, manual calendar, branded PNG and carousel PNG downloads. The optional Cloudflare AI artwork endpoint is authenticated, rate limited, size limited, and disabled unless deliberately configured.
- Billing modes: `BILLING_MODE=disabled` by default hides paid checkout. `test` shows a test-payment notice; `live` is for verified live credentials and a commercial launch. A missing or mismatched key disables paid checkout rather than exposing an incomplete payment flow.
- Google sign-in is enabled for the configured Orbact Supabase project. Email signup and reset links are hidden unless `ENABLE_EMAIL_SIGNUP=true` and `ENABLE_EMAIL_RECOVERY=true` after SMTP testing. Existing email accounts can still sign in.

## Deployed prototype and remaining launch conditions

**Deployment status on October 2, 2026:** Vercel Production serves commit `8b23271`, marked Ready. The active Production settings include `BILLING_MODE=disabled`, `ENABLE_GOOGLE_AUTH=true`, `ENABLE_EMAIL_SIGNUP=false`, `ENABLE_EMAIL_RECOVERY=false`, `ENABLE_QUOTE_IMAGES=true`, and `ENABLE_MANAGED_PUBLISHING=false`. The exact app origin is `https://orbact-repurpose.vercel.app`.

1. **Supabase:** The founder chose the existing `orbact-repurpose` Free project, which has existing accounts and a sandbox billing link. Its schema, profile trigger, RLS isolation, and credit functions passed live sandbox checks. Its Site URL and exact callback URLs match `https://orbact-repurpose.vercel.app`. Recheck `npm run db:check` after any migration. Do not replace its Stripe sandbox credentials with live credentials while old sandbox customer IDs remain in profiles.
2. **Authentication:** The existing project has Google enabled and custom SMTP off. Use Google sign-in for new users at zero cost. The app keeps email login for existing accounts but hides email signup and reset links by default. To offer public email signup later, configure custom SMTP, test delivery to addresses outside the Supabase organization, then set `ENABLE_EMAIL_SIGNUP=true` and `ENABLE_EMAIL_RECOVERY=true`. Supabase's default sender is restricted to project team addresses.
3. **AI and limits:** Server-only Groq and Upstash settings are present. Groq's project showed the Free plan; a live pasted-text generation succeeded and charged one credit. Upstash's `orbact-repurpose` Redis showed Free Tier in Frankfurt (`eu-central-1`), with 21 of 500,000 monthly commands used at inspection. A public article URL extracted successfully after the pinned DNS lookup fix. Captioned YouTube extraction and generation remain to be verified. Monitor free-tier quotas; a free tier cannot guarantee unlimited public traffic.
4. **Image creation:** The branded PNG and carousel PNG features are browser-generated and do not require an image API. Cloudflare Workers AI is configured in Production with server-only credentials and `ENABLE_QUOTE_IMAGES=true`. A real AI image was generated and exported with Orbact typography in square and portrait layouts. Workers AI has a daily Free allocation; exhaustion falls back to the browser-only design. Inspect every generated image before publishing.
5. **Origin and hosting:** Set `APP_URL` to the exact HTTPS production origin. Update Supabase redirects when the domain changes. Deploy this code to a host whose terms permit the intended use. The current Vercel Hobby deployment is a free prototype; [Vercel's Hobby terms](https://vercel.com/docs/plans/hobby) restrict commercial use. A paid SaaS launch requires an eligible host or plan.
6. **Billing:** For a free launch use `BILLING_MODE=disabled`. Existing sandbox-linked accounts remain in this reused database; preserve their records and allow their existing billing portal access, but do not offer new paid checkout. Paid Starter ($19/30 credits) and Pro ($49/150 credits) need a deliberate migration of sandbox profiles and verified live Stripe resources before setting `BILLING_MODE=live`. Test mode uses `BILLING_MODE=test` with sandbox keys and prices.
7. **Founder review:** Review the displayed Privacy Policy and Terms for the real operating entity, region, processors, data retention, and support contact before inviting users. Check the agency inquiry inbox in `agency_inquiries`; the app stores inquiries but does not email them.

## Production smoke sequence

1. Run `npm ci`, `npm test`, `npm run lint`, `npm run build`, and `npm run db:check` for the target environment.
2. Create two **new Google** users. Confirm each sees only their own profile, drafts, and manual calendar. Try to update `plan` and `generations_limit` using an authenticated Supabase client; RLS must deny it.
3. With one account, save a brand brief, extract a public article, generate once, edit and save a draft, export Markdown and JSON, download a carousel PNG and branded image, and add/mark a manual calendar entry. Repeat extraction with pasted text and a captioned YouTube video.
4. Confirm a failed AI request refunds its credit. Retry the same request ID after a network interruption; it must return the prior result or pending state without a second charge.
5. Submit an agency inquiry, verify it appears in `agency_inquiries`, and confirm the founder can review it. Check mobile layout, Google sign-in, sign-out, and the production function logs. Check confirmation and reset emails only after custom SMTP is enabled.
6. Confirm checkout returns unavailable while `BILLING_MODE=disabled` and no automatic publishing option appears. Leave Make for the later phase.

**Current launch boundary:** the deployed app is usable as a free prototype. Paid commercial launch still requires hosting that permits commercial use, a live billing migration for the existing sandbox-linked account, and the deferred Make work if automatic publishing is offered. Custom SMTP is needed before email signup and password recovery are enabled. Founder review of the Privacy Policy and Terms remains open.
