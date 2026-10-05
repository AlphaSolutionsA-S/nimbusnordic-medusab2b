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

## Consolidation - 2026-10-05

- `hasBusinessCentralOrder` in the pure order-ingestion state contract now consumes only nullable status and BC ID. Both widget confirmation and `shouldSkipBcSubmission` use this rule; no service/HTTP dependency is imported by the widget.
- New nullable-state unit assertions preserve untracked false and recorded-ID true. Existing widget tests retain failed-with-ID and sent-without-ID warnings/cancellation behavior.
- The existing subscriber export assertion now checks both automatic and Admin events while preserving the exact automatic event name. Earlier Task 03 search missed its aliased config name; this is a corrected new regression, not a pre-existing baseline failure.
- The new HTTP spec uses the common synthetic JWT secret. Installed test-utils loads medusa-config before applying per-suite env; mismatched shell/suite secrets can cause unrelated 401 failures. Full-suite results need one aligned environment.
- Business-rule registry and generated instructions record the shared predicate and explicit force exception. No architecture document is written before the human gate.
- Current branch diff snapshot excludes records/generated docs: production source 498 lines added/24 removed; tests 919 added/5 removed; Jest config 7 added/1 removed. Re-measure if formatting/source changes again.

### Security-path coverage

HTTP cases below are in `apps/backend/integration-tests/http/admin/bc-integration.spec.ts`; widget cases are in `apps/backend/src/admin/widgets/__tests__/bc-order-status.test.tsx`.

| Path | Behavior evidence |
|------|-------------------|
| Admin authorization on both operations | HTTP: anonymous, invalid and customer bearer denial; real Admin session authentication |
| Safe status response | HTTP: entire wrapper, exact DTO/line keys and consumed field types |
| Strict force intent and order existence | HTTP: missing orders and malformed/extra force intent |
| Default guard and explicit override | HTTP: normal duplicate protection and explicit force delivery |
| Identity safety after failed force | HTTP: failed force retains prior identity and ordinary duplicate protection |
| Explicit warning and cancellation | Widget: warning with BC ID, cancellation sends nothing, sent-or-ID confirmation cases |
| Failed status/start requests | Widget: blocked submission, manual recovery and sanitized errors |
| Accepted async start and overlap | HTTP: deferred vendor completion and automatic/Admin overlap |
| Owner isolation and compensation | HTTP: wrong-owner release and event-emission compensation |
| Lease renewal and cleanup | HTTP: original TTL exceeded, transient renewal recovery and cleanup |
| Retry after completion | HTTP: completed failed attempt can retry with shared transaction ID |

Local framework/PostgreSQL tests use fake vendor HTTP responses. No deployed delivery, browser placement or cross-instance lock guarantee is claimed.
