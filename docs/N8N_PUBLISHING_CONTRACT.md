# n8n publishing workflow contract

The application sends a signed HTTPS `POST` from `/api/cron/publish` to `N8N_PUBLISH_WEBHOOK_URL`. The workflow must complete within 20 seconds. The response must be JSON: `{ "status": "published", "externalId": "POST_ID" }` or `{ "status": "failed", "error": "CLEAR_REASON" }`. An HTTP error, timeout, or malformed response leaves the post in `needs_review` because the platform may have accepted it.

## Request authentication and shape

Headers: `Content-Type: application/json`, `X-Orbact-Job-Id: UUID`, `X-Orbact-Signature: HEX_HMAC_SHA256`. Compute the HMAC over the **raw UTF-8 request body** using `N8N_PUBLISH_SIGNING_SECRET`; compare in constant time before parsing or posting. Reject missing/incorrect signatures. Do not expose the signing secret in browser code or logs.

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

`thread` is only populated for X. `mediaUrl` is only populated for Instagram. Do not use `accountId` as an arbitrary URL; match it against the n8n credential/account mapping you configured. The queue only sends accounts from `publishing_connections`.

## Build the workflow in n8n

1. Create a Webhook trigger using `POST`, production URL, and a Respond to Webhook node. Keep the endpoint private. Add a Code node before any platform call to validate the signature against the raw body. Check n8n's current Webhook node raw-body setting and test with a known request: the HMAC must be over the exact bytes received, not reserialized JSON.
2. Add a durable idempotency store keyed by `jobId` and, for X, by `jobId` plus thread index. Before posting, return the already recorded platform ID if present. Record every successful platform operation immediately. This avoids duplicate posting when the app sees an uncertain response or a workflow execution is retried.
3. Switch on `platform`, select the credential mapped to `accountId`, and use the current official API for that account type. Never let the inbound payload choose an n8n credential or endpoint freely.
4. LinkedIn: post text to a member or approved organization account using the Posts API and the proper scope. Store the returned post URN/ID. Test member and organization permissions separately.
5. X: publish `thread[0]`, then each following post as a reply to the preceding returned post ID. Stop on the first error. Persist each post ID. A partial thread must return an uncertain state for manual review; do not start the thread again automatically.
6. Instagram: verify that `mediaUrl` is a reachable public JPEG from the configured Supabase bucket; create an image media container, wait for it to be ready as required by the API, then publish it. If the platform takes longer than 20 seconds, redesign this handoff as an asynchronous callback with signed status reconciliation before enabling Instagram managed delivery. Do not return `published` merely because container creation succeeded.
7. Facebook: publish text to the intended Facebook Page using the Page access token and record the returned post ID.
8. Use Respond to Webhook to return a definitive JSON result and HTTP 200 only after the platform confirms publication. Return `{ "status": "failed", "error": "..." }` only when the platform definitively rejected the operation and no post was created. If uncertain, return a non-200 response and reconcile manually.
9. Configure n8n error alerts for workflow failures. Keep a log of `jobId`, platform, account ID, platform IDs, timestamps, and error category without logging OAuth tokens or the signed body unnecessarily.

The local app has no automatic customer notification or one-click retry for failed jobs. Operators must review `failed` and `needs_review` rows and platform state. Removing a queued item before dispatch cancels it; a `publishing` item cannot be removed.

References: [n8n Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/), [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api), [X create post](https://docs.x.com/x-api/posts/manage-tweets/introduction), [Instagram API](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api), [Facebook API](https://www.postman.com/meta/facebook/documentation/r56bjfd/facebook-api).
