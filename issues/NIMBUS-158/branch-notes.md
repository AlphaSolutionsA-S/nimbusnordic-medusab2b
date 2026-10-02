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

## Task 02 - Admin order widget

- widgets/bc-order-status.tsx exports the auto-discovered order.details.side widget; hooks/api/bc-integration.tsx exports useBcIntegrationStatus/useSubmitOrderToBc and BcIntegrationResponse/SubmitOrderToBcInput.
- Requests use existing session SDK; DTO import from Task 01 is type-only.
- Initial mount loads status; explicit Refresh is the only later reload. No mutation invalidation, focus/reconnect or polling refresh.
- Normal start sends false. Sent OR any BC ID opens real Medusa Prompt; cancel makes no API call, confirmed force sends true with a duplicate warning/current ID.
- Successful status read required before submission; status fetching/error and mutation pending block it. Both controls disable during submission.
- Raw backend errors/messages never render; local feedback says accepted and asks for Refresh, without claiming BC completion.
- Eight RTL behavior cases use actual React Query/Prompt, SDK-only mocking. Jest maps React/JSX imports to backend React 18 because workspace icons otherwise bind React 19.
- Browser placement and deployed delivery remain unverified; Task 03 needs real HTTP/auth/background/renewal evidence.

## Task 03 - Real HTTP and reservation verification

- `integration-tests/http/admin/bc-integration.spec.ts` adds 12 cases against the actual Medusa app/PostgreSQL and real delivery workflows; vendor HTTP responses alone are synthetic.
- Both operations deny anonymous, invalid bearer and customer bearer requests with 401. Real Admin bearer/session requests work. Strict invalid bodies return 400 and missing orders return 404.
- Exact response/line whitelists exclude raw payload/vendor details. Deferred vendor lookup proves 202 precedes completion and both normal/force overlaps return 409.
- Ordinary already-sent requests perform no BC header write; explicit force writes, and failed force retains previous BC identity. Completed attempts can retry using the shared deterministic transaction ID.
- Automatic/Admin overlap, wrong-owner release protection and event-emission compensation use real lock/event/workflow primitives.
- A held vendor lookup remains reserved beyond the initial 3600s TTL, recovers one transient renewal failure and releases the reservation/timer after completion; subsequent force succeeds.
- Test-utils local PostgreSQL URL must contain `localhost` to avoid its forced-TLS branch; shell-only port55432/IPv4-first environment was used. Seeded reservations are drained before database reset because stored-workflow waiting does not await queued subscriber cleanup.
- Oct2 scoped HTTP12/12 passed54.6s; lint0errors13existingwarnings; tsc22unchanged baseline. Dedicated review and whole-branch finalization remain next. No live vendor/deployed result is claimed.
