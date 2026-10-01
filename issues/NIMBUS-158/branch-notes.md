# Branch notes

## Task 01 - Admin BC API

- GET `/admin/orders/:id/bc-integration` returns `{bc_integration: AdminBcIntegration}`; type exported from `workflows/business-central-order/utils/admin-bc-integration.ts`.
- Actual fields: status (nullable for untracked), bc_order_id, bc_order_number, attempt_count, initialized_at, last_attempt_at, sent_at, partial, failure_reason (known codes only), line_failures (`line_number`, `reason` only).
- POST `/admin/orders/:id/bc-integration/submit` strictly accepts `{force_resend?: boolean}` and returns 202 with message after `requestBcSubmissionWorkflow` reserves/queues; use manual refresh for outcome.
- Submission event is `order_ingestion.admin_bc_submission_requested`; existing automatic subscriber handles both events and shares owner reservation `bc-submission-<orderId>`.
- Keep `getSendOrderToBusinessCentralTransactionId` and store:true on every actual delivery run. Metadata pending never indicates an active run.
- Force input defaults false. Failed resend retains previous BC identity; Task 03 must cover this using the real workflow.
- Task 03 must prove default Admin auth/customer/anonymous denial, body validation, 404, 202 while vendor deferred, 409 for Admin+automatic overlap, reservation release on failure, completed retry, and failure-detail sanitization via real HTTP/framework.
- Four unit behavior cases pass. Root measured 22 existing whole-app TypeScript errors in legacy integration tests.
- Reservation renews every TTL/3 during delivery; cleanup clears the timer, drains renewal and releases by owner. Task 03 must hold a real workflow beyond initial TTL and prove 409 for overlapping requests and release after completion. Multi-instance behavior is unverified; no deployment has run.
