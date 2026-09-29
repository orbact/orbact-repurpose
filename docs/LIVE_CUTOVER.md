# Live billing cutover

This checklist records the production cutover for Orbact Repurpose. The public app currently runs at `https://orbact-repurpose.vercel.app`. Keep its existing sandbox configuration in place until every production resource below is ready and checked.

## Current state (September 29, 2026)

- Stripe sandbox checkout, renewal, payment failure and recovery, duplicate delivery, and out-of-order delivery have passed.
- The separate Orbact Stripe account still shows **Verify your business / Activate Payments**. Its business location is **United States**. The founder must supply the correct legal business type and verification details in Stripe; do not infer them from the app or select them on someone else's behalf.
- The existing Supabase project has five test profiles, including one Pro profile linked to a sandbox Stripe subscription. The founder chose a **fresh production Supabase project**, so these test users will register again.
- Vercel Production currently has sandbox Stripe variables. Its Supabase variables target both Production and Preview. Split these targets when replacing Production credentials so Preview keeps its test database.
- The Vercel team is on Hobby. Vercel limits Hobby to personal, non-commercial use. The founder prefers no paid plans, so keep Vercel for the free prototype. Before accepting paying customers, choose hosting that permits commercial use and verify the full app there; Netlify's free plan is a candidate that has not yet been tested with this app.
- No custom app domain has been supplied. Use the Vercel origin above until the final domain is connected, then update redirects, policies, and webhook URL together.

## Prepare resources

1. Finish Stripe's business verification in the **Orbact** live account. Confirm live payments are enabled. Verify legal business name, public support contact, statement descriptor, banking, tax settings, and policy URLs. Do not submit inaccurate US business details. The [Stripe API keys guide](https://docs.stripe.com/keys) explains how live keys and objects differ from test objects.
2. In Supabase, create a fresh production project. Save its database password securely. Apply [`202609290001_core.sql`](../supabase/migrations/202609290001_core.sql) in SQL Editor. Configure email auth, SMTP, Site URL `https://orbact-repurpose.vercel.app`, and exact `/auth/callback` redirect URLs. Copy the production URL, publishable/anon key, and service-role/secret key to a secure location. Keep the old project for Preview and sandbox testing.
3. In Stripe live mode, create monthly recurring USD prices for **Starter $19** and **Pro $49**. Record both live `price_...` IDs. Configure the live Customer Portal for payment-method updates, invoice history, cancellation at period end, and plan changes between those two prices without mid-cycle proration. Set its business details and policy links.
4. In Stripe live mode, create a webhook destination at `https://orbact-repurpose.vercel.app/api/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`. Record this destination's `whsec_...` once. The sandbox webhook secret will not verify live events.

## Cut over the chosen commercial host

The steps below describe the current Vercel project. If you choose another host to stay on a free plan, configure equivalent server-only and public variables there, deploy the app, and update the app origin and webhook URLs before accepting customers. Do not treat a Vercel Hobby deployment as the paid SaaS production host.

1. In the [project's Environment Variables](https://vercel.com/orbacts-projects/orbact-repurpose/settings/environment-variables), preserve the current test Supabase values for **Preview only**. Change **Production only** to the fresh project: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Keep the service-role key server-only.
2. Replace **Production only** `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, and `STRIPE_WEBHOOK_SECRET` with values from the same **live Orbact Stripe account**. The key must start `sk_live_`; the two prices must be live monthly USD $19 and $49. The webhook secret must belong to the live destination above. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is currently unused by the app; if retained, give it the matching `pk_live_` value.
3. Set `APP_URL` to the exact HTTPS origin of the chosen host; the Vercel origin is valid only while that is where the app runs. Keep `ENABLE_MANAGED_PUBLISHING=false` unless the separate publishing prerequisites have passed. Confirm Groq and Upstash usage remains inside their free-tier quotas or explicitly choose another operating plan.
4. [Redeploy Production](https://vercel.com/docs/environment-variables/managing-environment-variables) after editing variables; old deployments retain old values. Verify the new deployment is Ready and the production domain points to it.

## Acceptance before inviting customers

1. Confirm production signup, email confirmation and reset, sign-in and sign-out in the fresh Supabase project. The initial profile must be Free with three credits and no sandbox Stripe IDs.
2. Confirm the Starter and Pro checkout buttons create **live** Checkout sessions with the intended price and the Vercel success/cancel URL. Do not use Stripe test cards in live mode.
3. Confirm a genuine live subscription event appears in the live Stripe destination with HTTP 200 and updates `profiles` and `stripe_paid_invoices` once. A live paid transaction requires the founder to perform the payment. Recheck portal links, cancellation, and plan changes with real account data.
4. Check generation, rate limits, contact inquiries, logs, policy pages, and support links. Keep the old sandbox and Preview available for renewal, failure, and retry drills.

If Stripe verification or fresh Supabase setup is incomplete, do not replace Production with a partial mix of test and live credentials. Mixing modes can leave Checkout unusable or existing test customer IDs pointing at the wrong Stripe account.
