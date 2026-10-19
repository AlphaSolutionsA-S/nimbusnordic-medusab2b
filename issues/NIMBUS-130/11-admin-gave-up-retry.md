# 11: Admin recovery for shipments that gave up
**App:** backend · **Layer:** L6 (admin routes), L3/L4 (reopen workflow), Admin UI route · **Depends on:** 02, 05, 07

**Goal:** A Medusa Admin page that lists the shipment tracking rows closed `gave_up`, with a "Retry"
action that reopens a row so the next polling run checks it again (decision 8).
**Files / areas:**
- `apps/backend/src/api/admin/shipment-tracking/` (routes, `middlewares.ts`, validators), registered
  through `api/admin/middlewares.ts`;
- `src/workflows/shipment-notice/` (reopen workflow and step);
- `src/admin/routes/shipment-tracking/page.tsx`, with a data hook in `src/admin/hooks/api/` over
  `admin/lib/client.ts`.
Closest precedent: `api/admin/orders/[id]/bc-integration/` and `admin/routes/translations/`.
**Seam contracts:**
- `GET /admin/shipment-tracking?limit=&offset=` → `{ shipment_trackings, count, limit, offset }`.
  - Only rows closed `gave_up`, newest first.
  - Fields: `id`, `shipment_number`, `bc_order_number`, `order_id`, `external_order_number`,
    `company_id`, the company name (resolved through Query), `last_error` (code), `attempts`, the
    `closed_at` (gave-up) time.
  - No address or contact field.
- `POST /admin/shipment-tracking/:id/retry` → 200 with the reopened row.
  - Refused unless the row is closed `gave_up`: 404 when unknown; a 400 `not_allowed` error otherwise
    (e.g. `window_ended`; there is no reopen variant for it).
  - Reopening sets the row `open`, clears `close_reason`, resets `attempts` to 0, sets `next_check_at`
    to now, and records `reopened_at` and `reopened_by` (the admin user id from the auth context).
  - The reopened row gets the usual final-check and back-off rules, counted from `reopened_at`
    (task 05). Its `latest_revision` is kept.
- Auth: Medusa's default `/admin` authentication (user via bearer, session or api-key). Strict query
  and params schemas. The route runs the workflow; it never calls the service to mutate.
**Test intent:**
- HTTP contract (`integration-tests/http/admin/shipment-tracking.spec.ts`):
  - the list returns only `gave_up` rows with the field types above and no address field; paging
    works;
  - retry on a `gave_up` row → 200; the row is open and due now, with `reopened_by` = the admin user;
  - retry twice → the second call returns 400;
  - retry on `window_ended` → 400; on an unknown id → 404.
- Security (`security-boundaries.spec.ts`):
  - no auth → 401 on both routes;
  - a store customer token → 401;
  - a publishable key → 401.
- Integration: after a retry, the next check run checks the row (with task 07's stub). Another
  failure gives up again 3 days after `reopened_at`, not at once.
- Admin (`pnpm --filter @b2b-starter/backend test:admin`, RTL):
  - the page shows a spinner while loading, then rows;
  - "Retry" is disabled while pending;
  - after success the list query is invalidated and the row disappears;
  - an error shows a toast.
**Done when:**
- routes, workflow and page written;
- route bodies within `limit-route-body`;
- tests written;
- lint and typecheck at or below the baseline.
**Verify after deploy:** in Admin, "Shipment tracking" lists `gave_up` rows. After "Retry" on one, the
`shipment_tracking` row's `state` = `open` and `reopened_by` is set, and the next run's summary counts
it as checked.
**Also update:** `ai/skills/medusa-admin/project.md` (new admin route) if it lists admin pages.
