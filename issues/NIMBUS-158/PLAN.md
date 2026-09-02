# NIMBUS-158: Show Business Central status and retry in Medusa Admin

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-158
**Scope:** issues/NIMBUS-158/SCOPE.md (approved)
**Branch:** `feature/NIMBUS-158` (from `develop`)

## Objective

Add a widget to the Medusa Admin order-detail page that displays the order's current Business
Central integration status and BC order identifier, provides a manual **Refresh** action, and
provides a **Write to BC** action that starts NIMBUS-148's reusable BC submission workflow
asynchronously — with an explicit force-resend confirmation path for already-sent orders.

## Analysis

### Dependency status

NIMBUS-148 (BC submission workflow) and NIMBUS-149 (order persistence + integration-state
metadata) are **scoped but not yet implemented**. All NIMBUS-129 task files are `Status: TODO`.
This plan assumes the following contracts from those stories, based on their approved SCOPE.md
documents and the NIMBUS-129 task plans:

**Integration-state metadata** (from NIMBUS-149 SCOPE + NIMBUS-129 Task 03 plan):

The order's `metadata` field contains a `bc_integration_state` key (exact name TBD by NIMBUS-149
planner — this plan uses `bc_integration_state` as a placeholder and the implementor must
reconcile with the actual key name):

```typescript
interface BcIntegrationState {
  bc_order_id: string | null       // null until NIMBUS-148 sets it on success
  status: 'pending' | 'sent' | 'failed'
  timestamp: string                // ISO timestamp of last update
  retry_count: number              // incremented by NIMBUS-148 on every invocation
  // NIMBUS-148 may add partial-failure fields (order-level flag + per-line records)
}
```

**BC submission workflow** (from NIMBUS-148 SCOPE):

NIMBUS-148 will export a reusable workflow (name TBD by NIMBUS-148 planner — this plan uses
`submitOrderToBusinessCentralWorkflow` as a placeholder). Its input shape will include:

```typescript
interface SubmitOrderToBcInput {
  order_id: string
  force_resend?: boolean   // NIMBUS-158's addition — bypasses the duplicate guard when true
}
```

The workflow's duplicate guard short-circuits when `bc_integration_state.status === 'sent'` or
`bc_integration_state.bc_order_id` is set, **unless** `force_resend === true`.

### Codebase patterns discovered

1. **No widgets exist yet** — this will be the first admin widget in the project. The pattern is
   documented in `apps/backend/src/admin/README.md` and confirmed by Medusa docs: a `.tsx` file
   under `src/admin/widgets/` with a default-exported React component and a `defineWidgetConfig`
   export.

2. **Widget zone**: `order.details.side` — the side column of the order details page. This is
   the natural location for an integration-status panel. The widget receives
   `DetailWidgetProps<HttpTypes.AdminOrder>` with `data` being the `AdminOrder` object.

3. **Admin SDK client** (`apps/backend/src/admin/lib/client.ts`): configured with `baseUrl: "/"`
   and `auth: { type: "session" }`. All API calls use `sdk.client.fetch<T>(url, { method, body })`.

4. **Admin hooks pattern** (e.g. `hooks/api/companies.tsx`): `useQuery` for reads,
   `useMutation` for writes, `queryKeysFactory()` for cache keys, `queryClient.invalidateQueries()`
   on mutation success. This plan follows the same pattern for the BC status hooks.

5. **Admin API routes** (`src/api/admin/`): `AuthenticatedMedusaRequest` + `MedusaResponse`,
   `validateAndTransformBody` / `validateAndTransformQuery` middleware, Zod validators in
   `validators.ts`, middleware arrays aggregated in `src/api/admin/middlewares.ts`.

6. **Workflow invocation from routes** (e.g. `approvals/[id]/route.ts`):
   `workflow.run({ input, container: req.scope })` — errors surface as `{ result, errors }`;
   route checks `errors.length > 0` and returns 400.

7. **Order metadata access**: via `query.graph({ entity: 'orders', fields: ['id', 'metadata'],
   filters: { id } })` or `orderModuleService.retrieveOrder(id)` — the latter returns the full
   order including `metadata`.

### Key design decisions

**D1 — Two admin API routes, not direct SDK calls from the widget.**

The widget does not call NIMBUS-148's workflow directly or read order metadata via the SDK's
built-in order endpoint. Instead, two custom admin API routes provide a clean, authenticated
contract:

- `GET /admin/orders/:id/bc-integration` — returns the BC integration state (status, bc_order_id,
  retry_count, timestamp, partial-failure info if present). Reads from order metadata.
- `POST /admin/orders/:id/bc-integration/submit` — starts NIMBUS-148's workflow asynchronously.
  Body: `{ force_resend?: boolean }`. Returns 202 with a "processing started" message.

This follows the existing admin route pattern, keeps the widget thin, and ensures the backend
controls what metadata is exposed (per SCOPE: "Do not expose the raw canonical order payload,
credentials, customer tokens, internal exception details, or other secret material").

**D2 — Asynchronous submission start, not synchronous completion.**

Per SCOPE: "Start the submission asynchronously. After the start request is accepted, tell the
Admin that processing has started; do not wait for Business Central completion."

The POST route fires the workflow **without awaiting it** (same fire-and-forget pattern as
NIMBUS-129 Task 05's event emission) and immediately returns 202. The Admin uses **Refresh** later
to retrieve the outcome.

However, NIMBUS-148's workflow may not be designed for fire-and-forget invocation from a route
(it may be triggered by a subscriber). The implementor must verify how NIMBUS-148's workflow is
structured and use the appropriate async-trigger mechanism. If NIMBUS-148 uses a subscriber on
`order_ingestion.ready_for_business_central`, the POST route may need to emit that event (or a
new `order_ingestion.admin_retry_requested` event) instead of calling the workflow directly.

**D3 — Force-resend as an explicit workflow input parameter.**

Per SCOPE: "Enforce the distinction between a normal submission and a confirmed force resend on
the backend. A normal request must not bypass NIMBUS-148's duplicate guard."

The POST route passes `force_resend` from the request body to the workflow input. The workflow
itself (owned by NIMBUS-148) enforces the guard. The route does not do its own guard check — it
trusts the workflow. The route's only job is to pass the flag through.

**D4 — Concurrency protection via metadata status check.**

Per SCOPE open question: "The implementation planner must define how concurrent start requests
are rejected or serialized."

The GET route reads the current `bc_integration_state.status`. If `status === 'pending'` and
`retry_count` indicates a submission is already in progress (NIMBUS-148 sets status to `pending`
or a similar in-progress value at the start of its workflow), the POST route returns 409 Conflict
with a message like "A submission is already in progress. Use Refresh to check its status."

The exact in-progress indicator depends on NIMBUS-148's implementation — the implementor must
reconcile. If NIMBUS-148 does not set an in-progress status, this plan recommends adding a
`submitting` status value or a `last_submission_started_at` timestamp that the POST route checks.

**D5 — Widget in the side column (`order.details.side`).**

The side column is the natural location for a compact status panel with a few fields and action
buttons. The main column (`order.details`) is for larger content blocks. The side column keeps
the BC status visible alongside the order summary without pushing core order content down.

**D6 — No polling. The widget uses manual Refresh.**

Per SCOPE: "The widget does not poll or refresh automatically." The widget's Refresh button
triggers a `refetch()` on the `useQuery` hook. No `refetchInterval` or WebSocket.

**D7 — Force-resend confirmation via a Medusa UI Dialog.**

Per SCOPE: "show a confirmation before starting it; state clearly that the order has already been
sent; display the current Business Central order identifier in the warning when available; state
clearly that continuing may create another order in Business Central."

The widget uses `@medusajs/ui`'s `Dialog` component (not a native `confirm()`). The dialog shows
the warning text and the current BC order ID. The "Confirm" button in the dialog triggers the
POST with `force_resend: true`. The "Cancel" button closes the dialog without submitting.

## Execution Plan

### Task 01: Admin API routes for BC integration status and submission

**Files:**
- `apps/backend/src/api/admin/orders/[id]/bc-integration/route.ts` — GET handler
- `apps/backend/src/api/admin/orders/[id]/bc-integration/submit/route.ts` — POST handler
- `apps/backend/src/api/admin/orders/[id]/bc-integration/validators.ts` — Zod schemas
- `apps/backend/src/api/admin/orders/[id]/bc-integration/middlewares.ts` — middleware routes
- `apps/backend/src/api/admin/middlewares.ts` — updated to spread new middlewares

**What it does:**
- GET: reads the order by ID via `query.graph` or `orderModuleService.retrieveOrder`, extracts
  the `bc_integration_state` from `metadata`, returns a sanitized response (no raw canonical
  payload, no secrets).
- POST: validates the body (`{ force_resend?: boolean }`), checks for an in-progress submission
  (concurrency guard), fires NIMBUS-148's workflow asynchronously (or emits the appropriate event),
  returns 202.
- Middleware: `validateAndTransformBody` for the POST route, `authenticate` (admin session auth
  is applied by default for `/admin/*` routes — no explicit auth middleware needed).

### Task 02: Admin order-detail widget

**Files:**
- `apps/backend/src/admin/widgets/bc-order-status.tsx` — the widget component
- `apps/backend/src/admin/hooks/api/bc-integration.tsx` — React Query hooks for the two API routes

**What it does:**
- Displays the BC integration status as a `StatusBadge` (pending = orange, sent = green, failed =
  red).
- Displays the BC order identifier when present; shows "Not yet sent" when null.
- Displays the retry count and last-updated timestamp.
- Displays partial-failure info if present (which lines failed and why) — only if NIMBUS-148
  records this.
- **Refresh** button: calls `refetch()` on the status query.
- **Write to BC** button: if status is `pending` or `failed` (not sent), calls the POST mutation
  directly. If status is `sent` or a BC order ID exists, opens a confirmation `Dialog` with the
  duplicate-order warning before calling the POST mutation with `force_resend: true`.
- Disables buttons while requests are in progress (`mutation.isPending`).
- Shows error alerts if either request fails.

### Task 03: Integration tests

**Files:**
- `apps/backend/integration-tests/http/admin/bc-integration.spec.ts`

**What it does:**
Tests the admin API routes end-to-end via the HTTP test runner:
- GET returns the correct integration state for an order with `pending` status.
- GET returns the BC order ID for an order with `sent` status.
- GET returns 404 for a non-existent order.
- POST starts the submission workflow and returns 202.
- POST with `force_resend: true` bypasses the duplicate guard.
- POST without `force_resend` on an already-sent order is rejected by the workflow (not by the
  route — the route passes it through).
- POST returns 409 when a submission is already in progress.
- GET does not expose the raw canonical payload or secrets.

## Cross-Task Wiring Summary

- Task 01 exports the GET and POST route handlers and the Zod validators. The middleware
  aggregator (`src/api/admin/middlewares.ts`) is updated to include the new routes' middlewares.
- Task 02 exports the widget component (default export) and the hooks (`useBcIntegrationStatus`,
  `useSubmitOrderToBc`). The widget is auto-discovered by Medusa's admin widget loader (any `.tsx`
  file under `src/admin/widgets/` with a `defineWidgetConfig` export). The hooks are imported by
  the widget.
- Task 03 tests Task 01's routes. It does not test the widget's UI (no browser/E2E test
  infrastructure exists in this project for admin widgets).

## Environment / Config Changes

- `apps/backend/src/api/admin/middlewares.ts` — add `...adminBcIntegrationMiddlewares` to the
  aggregated array.
- No `medusa-config.ts` changes — admin session auth is applied by default to `/admin/*` routes.
- No new modules, no DB migrations, no env vars.
- No `pnpm` package installs — `@tanstack/react-query`, `react-router-dom`, `@medusajs/ui`,
  `@medusajs/icons`, and `@medusajs/admin-sdk` are already available (used by existing admin
  pages/hooks).

## Test Infrastructure

Backend test infrastructure already exists (`apps/backend/jest.config.js`,
`pnpm test:integration:http`). Tests follow the existing `medusaIntegrationTestRunner` pattern
from `apps/backend/integration-tests/http/`.

## Decisions & Trade-offs

### D1: Custom admin API routes vs. reading order metadata via the built-in SDK order endpoint

**Chosen:** Custom routes. **Why:** The built-in `sdk.admin.order.retrieve()` returns the full
order including `metadata`, which contains the raw canonical payload (potentially large, and
per SCOPE must not be exposed in the widget). A custom GET route returns only the sanitized BC
integration state. The custom POST route provides a clean mutation endpoint that invokes the
workflow with the correct input shape, rather than having the widget construct workflow inputs.

**Trade-off:** Two more route files to maintain. Worth it for the security boundary (sanitized
response) and the clean contract between widget and backend.

### D2: Fire-and-forget vs. await workflow completion in the POST route

**Chosen:** Fire-and-forget (return 202 immediately). **Why:** Per SCOPE: "Keep the interaction
usable during slow Business Central processing by returning after the work has been accepted
rather than holding the Admin request open until completion." BC API calls can take seconds or
longer; the Admin should not wait.

**Trade-off:** The Admin does not know the outcome immediately and must use Refresh. This is
explicitly the approved UX from the SCOPE.

### D3: Force-resend flag passed through the route, not checked by the route

**Chosen:** The route passes `force_resend` to the workflow; the workflow enforces the guard. **Why:**
Per SCOPE: "Enforce the distinction between a normal submission and a confirmed force resend on
the backend." The workflow is the backend's business-logic layer; the route is a thin HTTP
adapter. Duplicating the guard in the route would create a maintenance burden and a risk of the
two checks diverging.

**Trade-off:** A normal (non-force) POST to an already-sent order will start the workflow, which
will short-circuit internally. The route returns 202 even though the workflow may no-op. The
Admin will see the status unchanged on Refresh. This is acceptable — the alternative (checking
in the route) would require the route to understand the workflow's internal guard logic.

### D4: Concurrency guard via metadata status

**Chosen:** The POST route checks the current `bc_integration_state.status` before starting. If
a submission is already in progress, it returns 409. **Why:** Per SCOPE open question about
concurrent requests. This is the simplest mechanism that prevents duplicate submissions from
repeated clicks or parallel Admin sessions.

**Trade-off:** There is a TOCTOU window between the check and the workflow start. For this
story's scope (internal admin tool, not a high-concurrency public API), this is acceptable. A
stronger guarantee would require a database-level lock or an atomic metadata update, which is
out of scope for this story.

### D5: Widget zone — `order.details.side` vs. `order.details`

**Chosen:** `order.details.side`. **Why:** The side column is the natural location for a compact
status panel. The main column is for larger content blocks. The side column keeps the BC status
visible alongside the order summary.

**Trade-off:** The side column has less horizontal space. The widget's content (status badge, BC
order ID, retry count, two buttons, optional dialog) fits comfortably in a narrow column.

## Open Items for the Implementor

1. **Reconcile metadata key names** — the exact `metadata` key for the BC integration state
   (this plan uses `bc_integration_state` as a placeholder) and the exact field names within it
   must match what NIMBUS-149 and NIMBUS-148 actually produce. Check the implemented code, not
   just the SCOPE.md documents.

2. **Reconcile workflow name and input shape** — the exact workflow name and input type exported
   by NIMBUS-148 must be used. This plan uses `submitOrderToBusinessCentralWorkflow` and
   `{ order_id, force_resend? }` as placeholders.

3. **Reconcile async-trigger mechanism** — if NIMBUS-148's workflow is triggered by a subscriber
   on `order_ingestion.ready_for_business_central`, the POST route may need to emit that event
   (or a new event) instead of calling the workflow directly. Verify NIMBUS-148's actual trigger
   mechanism.

4. **Reconcile in-progress indicator** — if NIMBUS-148 does not set an in-progress status (e.g.
   `submitting`), the concurrency guard needs a different mechanism. Verify what NIMBUS-148
   actually writes to metadata at the start of its workflow.

5. **Reconcile partial-failure fields** — if NIMBUS-148 records per-line resolution failures, the
   GET route should expose them and the widget should display them. Verify the exact field names
   and shape.

6. **Verify `@tanstack/react-query` version** — the admin skill requires pnpm users to install
   the exact `@tanstack/react-query` version matching `@medusajs/dashboard`. Check if it is
   already installed (existing hooks use it) before adding the new hooks file.
