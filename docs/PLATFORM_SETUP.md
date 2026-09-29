# Orbact Repurpose: external platform setup

Use a test environment first. The production domain has not been supplied, so replace `https://YOUR-DOMAIN` everywhere with its exact HTTPS origin. These steps are the founder's external configuration tasks; no account settings are changed by this repository.

## 1. Supabase database and authentication

1. Create or choose a **test** Supabase project. In the project **Connect** dialog or Settings > API Keys, copy its URL and **publishable key** to `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Copy a **secret key** to the server-only `SUPABASE_SERVICE_ROLE_KEY`. The environment variable names are legacy names in this app; their values can be Supabase's newer publishable and secret keys. Never expose the secret key in a `NEXT_PUBLIC_` variable.
2. In Database > SQL Editor, inspect the existing `profiles`, `generations`, policies, triggers, and functions. Back up the project. Run [`202609290001_core.sql`](../supabase/migrations/202609290001_core.sql) in the test project. It adds the credit functions, billing invoice ledger, draft history fields, inquiry table, publishing queue, and RLS restrictions. Apply to production only after the test checklist below passes. The migration revokes the old client-callable `try_consume_generation` function, so coordinate the production migration with deployment of this version of the app; the older generation route will stop working afterward.
3. In Authentication > URL Configuration, set Site URL to `https://YOUR-DOMAIN`. Add exact redirect URLs `https://YOUR-DOMAIN/auth/callback` and `https://YOUR-DOMAIN/auth/callback?next=/reset-password`; also add local/preview URLs you actually use. Keep production allow-list entries narrow.
4. Enable Email auth. Configure custom SMTP for real users, then test confirmation and password reset. To enable Google, configure a Google Cloud OAuth web client, put the **Supabase Google callback URL** shown in the provider screen into Google's authorized redirect URIs, and enter the Google client ID/secret into Supabase. The app's `/auth/callback` belongs in Supabase's redirect allow list, not in place of the Supabase callback at Google.
5. If enabling managed Instagram publishing, create a Storage bucket named `publishing` with **public read access**, JPEG MIME restriction, and 4 MB file limit. The app uploads each image to a generated path under the authenticated user's ID. Public images can be viewed by anyone with the URL; do not use this bucket for private files.
6. Verify with two test accounts: each can read only its own profile and generations; neither can write plan, limit, usage, Stripe IDs, or call `reserve_generation`, `finish_generation`, `apply_paid_invoice`, or `claim_due_posts` using an authenticated key. Service-role keys must never enter browser bundles.

References: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [redirects](https://supabase.com/docs/guides/auth/redirect-urls), [Google auth](https://supabase.com/docs/guides/auth/social-login/auth-google), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets).

## 2. Stripe products and webhook

1. In **test mode**, create recurring monthly Starter `$19` and Pro `$49` prices. Put their `price_...` IDs in `STRIPE_PRICE_STARTER` and `STRIPE_PRICE_PRO`. The app grants 30 and 150 credits respectively; the free tier has 3.
2. Configure the Customer Portal for payment-method updates, invoices, cancellation at period end, and switching only between Starter and Pro. Keep quantity changes and prorated mid-cycle charges off for the initial launch; an immediate plan switch then changes the credit limit while the new amount begins at the next renewal. Test this policy with real sandbox subscriptions before enabling plan switching. Confirm the business name, support contact, and policy links.
3. Create a webhook destination at `https://YOUR-DOMAIN/api/webhooks/stripe`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`. Put **that endpoint's** signing secret in `STRIPE_WEBHOOK_SECRET` and the test API secret in `STRIPE_SECRET_KEY`.
4. Test checkout, plan changes, cancellation at period end, payment failure, a paid renewal, repeated webhook delivery, and out-of-order delivery. Check `profiles` and `stripe_paid_invoices` after each. Paid renewal resets used credits once for the next billing period. Only after this passes, create separate **live** prices, API key, webhook destination, and secret.

### If a paid invoice leaves the old plan or credits

1. Confirm the deployed app includes the `invoice.paid` handler. A local code fix does not change the Vercel deployment until a new deployment is promoted.
2. In Stripe **test mode** > Workbench > Webhooks, open the destination whose URL exactly matches the deployed `/api/webhooks/stripe` URL. Reveal its signing secret. In Vercel > Project > Settings > Environment Variables, set `STRIPE_WEBHOOK_SECRET` to that destination's `whsec_...` for the environment receiving the event. A Stripe CLI `listen` secret or a secret from another destination will fail verification. Redeploy after changing the Vercel variable.
3. Use Stripe Workbench **Resend** on the original `invoice.paid` event. This creates a fresh delivery signature. If sending from a script, sign the **exact bytes** sent in the POST body with a fresh timestamp and the destination secret. Do not reuse the event's original signature header or alter the body after signing. Keep normal signature timestamp verification enabled.
4. Check the delivery response in Stripe. A `400` means the request failed signature verification; check the exact destination secret, URL, raw body, and timestamp. A `500` means the signature passed but processing failed; read Vercel function logs for the event ID. A `200` only confirms the handler acknowledged the event; an older handler can acknowledge it without updating billing. Verify the linked `profiles` row has the expected plan/limit and `generations_used=0`, and that `stripe_paid_invoices` contains the invoice ID exactly once.
5. Replaying the same paid invoice must return `200` without creating another ledger row or resetting credits again. A plan-change proration does not start a new credit period.

References: [Stripe webhooks](https://docs.stripe.com/webhooks), [subscription events](https://docs.stripe.com/billing/subscriptions/webhooks), [portal setup](https://docs.stripe.com/customer-management/configure-portal).

## 3. Groq and Upstash

1. Create a dedicated Groq API key, set `GROQ_API_KEY`, and verify access to the configured `openai/gpt-oss-120b` model. Test real articles and transcripts for factual accuracy before inviting customers. Set spend/rate alerts in Groq.
2. Create an Upstash Redis database near the Vercel region. Copy its REST URL and token to `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Use separate resources for test and production.

References: [Groq quickstart](https://console.groq.com/docs/quickstart), [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted).

## 4. Vercel deployment and domain

1. Import the repository into Vercel. If the imported Git root is the parent `V1` folder, set Project Settings > Build and Deployment > Root Directory to `orbact-repurpose`. Confirm Next.js detection.
2. In Settings > Domains, attach your domain and apply the DNS records Vercel gives you. Then set `APP_URL=https://YOUR-DOMAIN` in Environment Variables, without a trailing slash.
3. Add the Supabase, Groq, Upstash, and Stripe variables above to the correct Preview/Production environments. Use test credentials on Preview and live credentials on Production. Redeploy after variable changes.
4. Leave `ENABLE_MANAGED_PUBLISHING=false` until step 5 is complete. The manual calendar works without n8n or a publishing cron.
5. Deploy and run the production checklist below. Watch Vercel function logs for API, webhook, and cron failures. Configure spend alerts and database backups.

References: [Vercel environment variables](https://vercel.com/docs/environment-variables), [domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

## 5. Managed publishing on all four platforms

The app includes an approved queue and signed n8n handoff. It does **not** contain your platform credentials or an n8n workflow. Complete [the publishing contract and workflow](N8N_PUBLISHING_CONTRACT.md) before enabling it.

1. Set up an n8n instance reachable over HTTPS and keep `N8N_PUBLISH_SIGNING_SECRET` in both n8n and Vercel. Point `N8N_PUBLISH_WEBHOOK_URL` to its production webhook. The workflow must validate the HMAC signature and return a definite result synchronously. Store social OAuth tokens in n8n credentials, not in Supabase or the browser.
2. Obtain LinkedIn, X, and Meta developer permissions for the account types to be connected. Test a private account/Page on each platform. Instagram publishing needs a professional Instagram account and a public image URL. LinkedIn member and organization posting permissions differ. X needs user-authorized posting access. Facebook needs Page publishing access and a Page token.
3. For each user and approved account, provision a `publishing_connections` row using Supabase SQL Editor or a future administrator tool: `insert into public.publishing_connections (user_id, platform, external_account_id, enabled) values ('USER_UUID', 'linkedin', 'PLATFORM_ACCOUNT_ID', true) on conflict (user_id, platform) do update set external_account_id = excluded.external_account_id, enabled = true;` Repeat for `x`, `instagram`, and `facebook` with their actual account IDs. The ID must match the account credential selected by the n8n workflow. This step cannot be self-served in the app yet.
4. Generate a long random `CRON_SECRET` and put it in Vercel. Configure a scheduled `GET https://YOUR-DOMAIN/api/cron/publish` with `Authorization: Bearer YOUR_CRON_SECRET`. Use a schedule suited to the promised timing; [Vercel Hobby cron is daily and has an invocation window, while paid plans support finer schedules](https://vercel.com/docs/cron-jobs/manage-cron-jobs). Use a paid cron or external scheduler for minute-level delivery. Do not promise exact-minute posting until measured in production.
5. Set `ENABLE_MANAGED_PUBLISHING=true` only after the workflow, scheduler, account connection, and platform tests pass. It exposes the **Publish automatically** choice only on enabled connections. Every queued post requires explicit approval by selecting **Approve & schedule**.
6. Test published, platform-rejected, timeout, and duplicate job cases. A timeout becomes `needs_review`; verify the platform manually before any replay so the post is not duplicated. Failed and uncertain deliveries are visible in the calendar and should be monitored in Supabase/Vercel logs. Automatic customer notifications are not implemented.

Primary platform references: [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api), [X posts API](https://docs.x.com/x-api/posts/manage-tweets/introduction), [Meta Instagram API](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api), [Meta Facebook API](https://www.postman.com/meta/facebook/documentation/r56bjfd/facebook-api).

## Production acceptance checklist

- A new email user confirms, signs in, resets password, and signs out; a Google user signs in if Google is enabled.
- Two users cannot read or edit each other's drafts or calendar items; neither can alter billing fields with the anon/authenticated key.
- Article, captioned YouTube, and pasted-text extraction work; blocked internal URLs remain blocked.
- Generation produces useful drafts; invalid model output and server failures refund the reserved credit; retrying a request ID does not double charge.
- Starter/Pro checkout and portal work; webhook retries and renewal keep limits and usage accurate.
- Draft editing, save, history, export, carousel download, and manual calendar work on desktop and mobile.
- Contact inquiries reach the database and the founder has a process to review them. The app does not send email notifications for inquiries.
- Each connected platform publishes a test post through n8n, displays the external post ID, and handles failure/uncertainty correctly.

The app's privacy and terms pages are implementation drafts; have them reviewed for the actual business jurisdiction and data retention policy before a public launch.
