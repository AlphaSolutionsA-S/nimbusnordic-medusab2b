# Deviation report: Business Central status and retry in Medusa Admin

## Deviations from scope and plan

- Replaced placeholder metadata names with the implemented `business_central_integration` contract and its actual fields. Acceptable reconciliation explicitly required by the plan.
- Replaced the unawaited delivery call with an awaited acceptance workflow that reserves the order and emits an event; the existing subscriber then runs the existing delivery workflow. Acceptable: preserves asynchronous acceptance and follows current architecture rules.
- Replaced the proposed pending-metadata concurrency check with a shared owner reservation. Pending is the initial state, not evidence of active processing. Automatic and Admin submissions use the same reservation key and deterministic delivery transaction ID. Acceptable; actual HTTP tests prove overlap rejection.
- Added reservation renewal every TTL/3 because existing vendor lookups have no bounded duration. Cleanup stops the timer, drains pending renewal and releases by owner. Acceptable; a real workflow held beyond the original TTL remains reserved and cleans up.
- Used installed Medusa UI `Prompt` instead of the nonexistent `Dialog` export. Acceptable; real UI tests cover the warning, current identifier, cancellation and explicit confirmation.
- Omitted mutation invalidation and automatic query refresh despite the legacy skeleton. Acceptable: the approved scope explicitly requires manual Refresh.
- Sanitized failure information to known codes and line number/reason, omitting vendor messages and item identifiers. Acceptable: fulfills the scope's disclosure restriction.
- Retained the previous BC identity when a forced resend fails before obtaining a new identity. Acceptable: ordinary requests remain duplicate-safe after failed force.
- Added real framework/PostgreSQL and widget behavior coverage rather than the placeholder tests. Vendor HTTP responses and SDK transport are synthetic; framework delivery and UI primitives remain real.
- Aligned Jest React runtimes and the new HTTP fixture's synthetic JWT secret with existing test infrastructure. Acceptable; no production dependencies or authentication configuration changed.

## Consolidation changes

- Widget confirmation and backend submission protection share `hasBusinessCentralOrder`; both business rules are registered in the architecture registry.
- Added nullable Admin-state predicate coverage.
- Corrected the existing subscriber registration assertion to include both automatic and Admin events while preserving the original ingestion event assertion. The earlier Also-update search missed the aliased config reference; this introduced regression was repaired.
- Refreshed generated instructions and the Admin skill's widget/manual-refresh guidance.
- Removed three unused type export modifiers and added explicit deployment checks to every task.

## Findings

- No unresolved mechanical wiring or feature behavior blocker was found.
- Existing infrastructure limitation, medium: `apps/backend/medusa-config.ts:12` does not override Medusa's local event bus or in-memory workflow engine/locking defaults. Installed primitive source confirms that manual transaction overlap detection and reservations are process-local. Tests establish exclusion within one application process; they do not establish exclusion between application instances. Local event acceptance does not establish durable delivery through a process restart. This branch does not change the hosting infrastructure.
- Verification limitation: deployed widget placement, actual Business Central delivery and deployed topology remain UNVERIFIED.
- Whole-suite verification is not green. Quote HTTP and legacy BC module fixture failures remain below; their symptoms match documented baseline categories, but those failures were not reproduced at the merge-base. They are not represented as conclusively proven pre-existing failures.

## Tests

Security and behavior coverage includes:

- Both Admin operations deny anonymous, invalid bearer and customer bearer access; actual Admin bearer and session authentication succeed.
- Exact response and line-field whitelists exclude canonical payload and vendor details.
- Strict force validation, missing-order errors, asynchronous acceptance and normal/forced overlap rejection.
- Ordinary duplicate protection, explicit force delivery, prior identity retention after failed force and retry after completion.
- Automatic/Admin reservation sharing, owner isolation, event-emission compensation, renewal beyond the original TTL and timer/reservation cleanup.
- Actual widget warning and cancellation, explicit force payload, initial-loading/error submission protection, sanitized errors and manual-only refresh.

Against merge-base `f1896897fdd2cdd42c61479d238ac025dcbef3a1`, the branch adds 919 test lines and removes 5, adds 498 production source lines and removes 24, and changes Jest configuration by 7 additions/1 removal. There is no target ratio. Unit, widget and HTTP cases overlap intentionally at different boundaries; full backend discovery also includes generated duplicates, so suite totals are not unique source-test counts.

Final checks on 2026-10-05:

| Check | Observed result |
|---|---|
| Full backend unit tests | 33 suites, 269 tests passed; generated duplicates included |
| Full Admin tests | 4 suites, 37 tests passed |
| New Admin HTTP cases | 12 passed in the combined full HTTP run |
| Full HTTP suite | 11 suites passed, 2 failed; 146 tests passed, 8 failed; 510.2 seconds |
| Full module suite | 26 suites passed, 2 failed; 301 tests passed, 2 failed; 90.5 seconds |
| Backend typecheck | 22 unchanged baseline diagnostics; no new diagnostics |
| Backend lint | 0 errors, 13 existing warnings |
| Generated instruction check | Passed |
| Final backend/Admin build | Passed; backend 19.68 seconds, Admin 58.14 seconds |

The eight HTTP failures are seven store quote cases and one Admin quote case failing during cart seeding with HTTP 400. Feature, security-boundary, Business Central, order API and ingestion suites passed. The two module failures are the source/generated copies of the legacy BusinessCentralModuleService listOrders roundtrip fixture, whose exhausted fetch responses cause an undefined `.ok` access. Adapter source was unchanged. These symptoms are consistent with documented baseline failures; merge-base reproduction was not performed.

## Open questions

None remain concerning the feature contract or implementation decisions. The infrastructure and deployment verification limits above remain explicit.

## Verify after deploy

### Task 01: Admin API Routes for BC Integration Status and Submission

Verify after deploy: On a designated order in the approved BC test environment, verify unauthenticated GET and POST return 401; an Admin POST returns 202 before completion, another request during active processing returns 409, and a later GET returns the persisted outcome and BC identifier.

### Task 02: Admin Order-Detail Widget for BC Status and Retry

Verify after deploy: Open the deployed Admin order detail for a designated BC test order; verify status loads, submission reports acceptance without automatically reloading, and Refresh shows the later outcome. On an order with sent status or a BC identifier, verify the warning includes the identifier when present, Cancel sends no POST, and explicit confirmation sends force_resend true. Verify focus/reconnect alone sends no status GET.

### Task 03: Integration Tests for BC Integration Admin API

Verify after deploy: For a designated order in the approved BC test environment, read the completed state after an accepted submission and compare its BC identifier/order number with the actual BC sales order. Verify an ordinary repeat creates no additional BC order, and an explicitly confirmed force resend creates a new BC order whose identifier is persisted and visible after manual Refresh.
