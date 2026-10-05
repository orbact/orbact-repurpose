# Orbact Repurpose V1 and customer V2 boundary

V1 publishes only for Orbact-controlled accounts. The current social account IDs, Make OAuth connections, visual logo, website, palette, and social footer belong to Orbact. Do not grant another user access to those account connections. The app's generation and calendar records remain scoped by Supabase user ID.

## V1 workflow

- A user reviews generated copy for each platform. They can approve one connected platform or all connected Orbact platforms, either for immediate delivery or a scheduled delivery. Each platform gets its own queue row and external post ID.
- Immediate delivery uses stable client request IDs so a lost HTTP response can be checked without creating another post. Scheduled delivery uses the daily cron. Make must return a confirmed platform ID before the app marks a post published.
- Instagram requires a public JPEG. Image Studio can export its finished composition as JPEG for the planner; the planner uploads it to the user's path in the Supabase `publishing` bucket. LinkedIn and Facebook Make branches currently post text only. X stays manual while the budget is zero.
- An uncertain delivery stops in `needs_review`. The operator checks the social platform and Make receipt, then records the confirmed external ID or confirms no post exists. The app never automatically retries an uncertain delivery.
- Keep `ENABLE_MANAGED_PUBLISHING=false` while Make is inactive or acceptance checks remain open. A successful code build alone does not authorize public posts.

## V2 seams for customer accounts

1. Replace the Orbact visual constants in `src/lib/visual-template.ts` with a per-workspace brand profile: wordmark, logo, website, font, colors, footer icons, layout preferences, and owned asset URLs. Keep the same fit and contrast checks for every brand.
2. Replace operator-provisioned `publishing_connections` rows and fixed Make filters with an authenticated connection flow. Store platform tokens only in the integration service or an encrypted server-side vault. Bind each queue job to a workspace and a specific connected account; verify that the approving user may publish there.
3. Give each customer isolated Make routing or a service that safely selects credentials by the verified connection ID. Do not use request-provided account IDs as arbitrary credential selectors.
4. Persist generated artwork and finished images as media records with ownership, MIME type, size, and deletion lifecycle. Extend queue rows with per-platform media and carousel assets. Add LinkedIn/Facebook image posts and Instagram carousel steps only after their platform responses and receipts are tested.
5. Add workspace roles, approval policy, post audit history, account reconnection, failure alerts, quota controls, and customer support tooling before offering unattended multi-tenant publishing.
6. Keep optional paid X delivery behind a separate budget and account-level consent. The free V1 uses copyable X threads.
