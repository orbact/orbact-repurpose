# Make publishing scenario contract

Orbact sends an HTTPS `POST` from `/api/cron/publish` to a **new, dedicated** Make Custom webhook. Existing Make scenarios must not be reused or edited. The webhook must have Make's native **API Key authentication** enabled. Store its URL in the server-only `MAKE_PUBLISH_WEBHOOK_URL` variable and the matching key in `MAKE_WEBHOOK_API_KEY`. Orbact sends that key in `x-make-apikey`; Make checks it before running the scenario. Keep the webhook URL and key out of browser code, scenario notes, logs, and screenshots.

The app waits at most 20 seconds for a definitive JSON response. Return `{ "status": "published", "externalId": "POST_ID" }` only after the platform confirms a real post ID. Return `{ "status": "failed", "error": "CLEAR_REASON" }` only when no platform post was created. The ID must be a nonempty string of at most 200 characters. Make's default `200 Accepted` response is **not** proof of publication; Orbact treats it as `needs_review`. HTTP errors, timeouts, invalid JSON, and missing IDs also become `needs_review` because the platform may have accepted the post.

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
6. Instagram: use a professional account and publicly reachable JPEG. Create its media container, wait until it is ready, then publish and return the **published media ID**. If this cannot finish within Orbact's 20-second timeout, leave Instagram managed delivery disabled until an asynchronous reconciliation design is implemented.
7. X: leave this branch disabled while operating at zero cost. The official API requires prepaid credits and charges per post. If funding is later approved, create each post as a reply to the prior returned ID and record partial progress.
8. Add **Webhooks > Webhook response** to each definitive branch. Set HTTP 200, `Content-Type: application/json`, and the exact JSON response above. A definite rejection with no post may use `status: failed`; an uncertain result must return a non-200 response for manual review. Do not leave Make's default `Accepted` response in a publishing branch.
9. Test bad/missing API key, malformed body, duplicate `jobId`, successful post, definite rejection, timeout, and partial platform completion. Check both Make history and Orbact's `publish_queue` row. Never replay an uncertain job before checking the platform.

Make Free currently lists **1,000 credits/month**, **two active scenarios**, and one 1 MB Data Store. Custom webhooks are instant triggers; the 15-minute minimum applies to scheduled scenarios. Orbact's Vercel Hobby cron still runs only daily with an hour-wide window, so exact-time publishing is not available in this free setup. Make's scenario consumes credits per module action; monitor usage and stop before it is exhausted. Keep `ENABLE_MANAGED_PUBLISHING=false` and `MANAGED_PUBLISH_PLATFORMS` empty until all prerequisites for a platform have passed.

References: [Make pricing](https://www.make.com/en/pricing), [Custom webhook and response](https://apps.make.com/gateway), [Data Stores](https://help.make.com/l6du-data-stores), [Vercel Hobby cron](https://vercel.com/docs/cron-jobs/usage-and-pricing), [X API pricing](https://docs.x.com/x-api/getting-started/pricing).
