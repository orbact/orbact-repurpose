# Make publishing scenario contract

The [dedicated Make scenario](https://us2.make.com/1640957/scenarios/6445790/edit) is configured and saved. Its Instagram, LinkedIn company Page, and Facebook Page branches claim a job ID, create the platform post, store a durable receipt, and then return the post ID. Posting and receipt errors return HTTP 502 for manual review. All three branches published one approved public test post on October 4. On October 5, the local app-to-Make nonposting failure path returned `failed` with no platform ID, and a separately approved LinkedIn company Page post passed through the deployed Orbact app, Vercel cron, Make posting module, Make receipt module, and webhook response. The app recorded `published` with `urn:li:share:7512735025965215745`; [Make's run](https://us2.make.com/1640957/scenarios/6445790/logs/6c01335669d44c9e98a993a84dd91693) completed all five operations. The scenario and the app's managed publishing switch were turned **off** again after this test.

The LinkedIn company Page test returned `urn:li:share:7512544666886496256`; the Orbact Facebook Page test returned `1285625971308849_122100882339497729`; the [Instagram Business test post](https://www.instagram.com/p/DeFDScEjJzM/) returned `17883702186511036`. The first Instagram attempt failed with Meta error `9007` (media ID unavailable) and received HTTP 502; its receipt is `needs_review` without an external ID. A separate, approved retry published successfully in seven seconds. This demonstrates that the native Instagram module can fail transiently. Never automatically resend a job with an uncertain outcome. The LinkedIn and successful Instagram requests were processed from Make's queue after the caller had received the default `200 Accepted`, so their run histories warn that a webhook response could no longer reach the original caller. Treat `Accepted` as uncertain and reconcile the platform and receipt before any retry.

Orbact sends an HTTPS `POST` from `/api/cron/publish` to a **new, dedicated** Make Custom webhook. Existing Make scenarios must not be reused or edited. The webhook must have Make's native **API Key authentication** enabled. Store its URL in the server-only `MAKE_PUBLISH_WEBHOOK_URL` variable and the matching key in `MAKE_WEBHOOK_API_KEY`. Orbact sends that key in `x-make-apikey`; Make checks it before running the scenario. Keep the webhook URL and key out of browser code, scenario notes, logs, and screenshots.

The app waits at most 15 seconds for a definitive JSON response. Return `{ "status": "published", "externalId": "POST_ID" }` only after the platform confirms a real post ID. Return `{ "status": "failed", "error": "CLEAR_REASON" }` only when no platform post was created. The ID must be a nonempty string of at most 200 characters. Make's default `200 Accepted` response is **not** proof of publication; Orbact treats it as `needs_review`. HTTP errors, timeouts, invalid JSON, and missing IDs also become `needs_review` because the platform may have accepted the post.

## Request body

```json
{
  "jobId": "UUID",
  "userId": "UUID",
  "platform": "linkedin | x | instagram | facebook",
  "accountId": "configured platform account ID",
  "content": "approved post copy",
  "thread": ["approved X post 1", "approved X post 2"],
  "mediaUrl": "https://.../storage/v1/object/public/publishing/...jpg",
  "scheduledAt": "ISO 8601 timestamp"
}
```

`thread` is used only for X; `mediaUrl` is used only for Instagram. The app also sends `X-Orbact-Job-Id`. Treat `accountId` as a lookup key against a fixed account-to-credential mapping that you control. Never map it into a free-form URL or select an arbitrary credential from the request.

## Build the new scenario

1. Create a new scenario named **Orbact Repurpose — Publishing**. Add **Webhooks > Custom webhook**, create a new webhook, add an API key, and copy its URL into Vercel only after the workflow is complete. A Make webhook can expose request headers and a JSON body; no raw-body HMAC step is needed because Make authenticates `x-make-apikey` itself.
2. Add a router with one branch per **tested** platform/account. Start with a single test branch and keep the scenario inactive until its credential and response handling pass. Use Make connections or HTTP credentials for platform tokens. Do not store tokens in Supabase or incoming payloads.
3. Use a durable idempotency record keyed by `jobId` before attempting a platform call. Make Free includes one 1 MB Data Store. If a job already has a confirmed platform ID, return that ID without posting again. Record each successful platform operation immediately. For an X thread, record each index and resulting post ID; a partial thread must never restart from post 1 automatically.
4. LinkedIn: post to a member or approved organization using the permitted API and return the resulting post URN. Test member and organization scopes separately.
5. Facebook: post to the configured Page with a Page access token and return the post ID.
6. Instagram: use the connected `@orbactco` Business account and a publicly reachable JPEG. Make's native **Create a photo post** module handles the media container and publish operation; a successful test finished in seven seconds, but an earlier attempt returned Meta error `9007`. Do not retry an uncertain post automatically. If this error recurs for real jobs, inspect the account and receipt before a new attempt or replace the native operation with a container-status workflow that waits for `FINISHED` before publishing.
7. X: leave this branch disabled while operating at zero cost. The official API requires prepaid credits and charges per post. If funding is later approved, create each post as a reply to the prior returned ID and record partial progress.
8. Add **Webhooks > Webhook response** to each definitive branch. Set HTTP 200, `Content-Type: application/json`, and the exact JSON response above. A definite rejection with no post may use `status: failed`; an uncertain result must return a non-200 response for manual review. Do not leave Make's default `Accepted` response in a publishing branch.
9. Test bad/missing API key, malformed body, duplicate `jobId`, successful post, definite rejection, timeout, and partial platform completion. Check both Make history and Orbact's `publish_queue` row. Never replay an uncertain job before checking the platform.

Make Free currently lists **1,000 credits/month**, **two active scenarios**, and one 1 MB Data Store. Custom webhooks are instant triggers; the 15-minute minimum applies to scheduled scenarios. Orbact's Vercel Hobby cron still runs only daily with an hour-wide window, so exact-time publishing is not available in this free setup. Make's scenario consumes credits per module action; monitor usage and stop before it is exhausted. Keep `ENABLE_MANAGED_PUBLISHING=false` until the remaining checks pass. `MANAGED_PUBLISH_PLATFORMS=linkedin` remains saved from the controlled test but cannot enable publishing while the global switch is off.

References: [Make pricing](https://www.make.com/en/pricing), [Custom webhook and response](https://apps.make.com/gateway), [Data Stores](https://help.make.com/l6du-data-stores), [Vercel Hobby cron](https://vercel.com/docs/cron-jobs/usage-and-pricing), [X API pricing](https://docs.x.com/x-api/getting-started/pricing).
