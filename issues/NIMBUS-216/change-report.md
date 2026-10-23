# NIMBUS-216: Change report

## Summary

The Admin "Shipment tracking" page now has a second, read-only section, "All shipments". It lists
every Business Central shipment the backend tracks (one `shipment_tracking` row per BC shipment, in
any state), 50 per page, with the newest posting date first. The existing given-up list and its
Retry action stay at the top of the page and work as before. There is no data-model change, no
change to the order API, and no change to how shipments are fetched from BC or checked.

## Flows

1. An Admin user opens Shipment tracking. The page loads both lists in parallel:
   `GET /admin/shipment-tracking` (given up, 20 per page) and
   `GET /admin/shipment-tracking/overview?limit=50&offset=0`.
2. Each section has its own loading state, error state, empty state and Previous/Next paging.
3. Retry on a given-up row invalidates every `["shipment-tracking", …]` query. Both lists then
   refresh, so the retried row's status in the overview changes to "Open".

## What was built

- `GET /admin/shipment-tracking/overview` (L6) in
  `apps/backend/src/api/admin/shipment-tracking/overview/route.ts`.
  - It calls `query.graph` on `shipment_tracking` with no state filter and orders by
    `posting_date DESC, id DESC`.
  - It looks up company names the same way the given-up route does.
  - Response: `{ shipment_trackings: [{ id, shipment_number, bc_order_number,
    external_order_number, company_id, company_name, posting_date, state, close_reason }], count,
    limit, offset }`.
  - Authentication is the Admin default: user session or secret API key.
- Validator `AdminShipmentTrackingOverviewQuery` in `validators.ts`, registered in
  `middlewares.ts`.
  - It accepts only `limit` and `offset` and rejects any other key.
  - `limit` is 1–200 with a default of 50. `offset` is 0 or more.
- Hook `useShipmentTrackingOverview(limit, offset)` in
  `apps/backend/src/admin/hooks/api/shipment-tracking.tsx`. Its query key is
  `["shipment-tracking", "overview", limit, offset]`.
- `apps/backend/src/admin/routes/shipment-tracking/page.tsx`: the new "All shipments" section has
  these columns:
  - Shipment
  - BC order
  - Customer order
  - Company (falls back to the company id)
  - Shipment date (`posting_date`)
  - Status: "Open", or "Closed: cancelled / window ended / superseded / gave up"

## Security

- Property: only Admin credentials can read the overview.
- Control: Medusa's default authentication for `/admin` routes.
- Negative test: `security-boundaries.spec.ts` "denies %s credentials on every admin shipment
  tracking endpoint" now also covers `GET /admin/shipment-tracking/overview` with no credentials,
  customer credentials and a publishable key, each expecting 401. It has not been run yet (see
  Tests).
- Response fields: the route returns no `last_error`, payload or personal data beyond the company
  name.

## Decisions

- **A separate endpoint, not a flag on the existing route.** The given-up route and its contract
  stay untouched, and neither route branches.
- **Matcher check.** Medusa registers method-specific middlewares with `app.get(matcher)`, which
  Express 4 anchors to the full path. So the given-up route's validator does not also run on
  `/overview`. This was verified from the installed framework source (`define-middlewares.js`,
  `router.js`).
- **Status shows state plus close reason only.** `last_checked_at` and the revision are left out
  because they were not asked for. A closed row with no reason renders "Closed"; the service never
  writes such a row.
- **Equal posting dates are ordered by id, newest first.**
- **Sort assumption.** `posting_date` is stored as text from BC's `postingDate`. Sorting it as text
  assumes the `YYYY-MM-DD` format, and the comment in the route says so. This is unverified until
  it is checked on real rows.
- **Confirmation step.** The plan was not shown to Klaus separately before coding. He had already
  given the go-ahead and accepted every answer the plan is built on (`feature.md`, "Answers").

## Tests

- Admin (`src/admin/routes/shipment-tracking/__tests__/page.test.tsx`), passing:
  - "lists all shipments below the given-up section with their status": checks the order of the
    sections, the status texts, that there is no Retry button, and that the first request is
    limit 50, offset 0.
  - "pages the overview by 50 independently of the given-up list".
  - "shows the overview's own load error while the given-up list still renders".
  - The 4 existing given-up tests still pass.
- HTTP (`integration-tests/http/admin/shipment-tracking.spec.ts`), written but **not run**:
  - "overview lists every shipment in any state, newest posting date first, with safe fields and
    paging": covers open rows, every close reason, the exact field set, `count`, paging and the
    default limit of 50.
  - "overview breaks equal posting dates by id, newest id first".
  - The existing validation test now covers both GET routes: unknown keys, invalid paging and
    `state=open` all return 400.
- Why the HTTP specs were not run: there is no reachable local Postgres, and the
  `BUSINESS_CENTRAL_DISCOVERY_URL` guard in `integration-tests/global-setup.ts` stops the run.

## Also updated

- `ai/skills/medusa-admin/project.md`: the Shipment recovery bullet now covers the overview list.
- `integration-tests/http/security/security-boundaries.spec.ts`: covers the new endpoint.
- The existing page test's fetch mocks now answer by URL, because the two sections load in
  parallel.
- No `docs/architecture/` section describes this page.

## Verify after deploy

On the deployed backend, open Admin > Shipment tracking > All shipments and check:

- The count is about 160 shipments.
- The first page shows the newest posting dates first. Real `posting_date` values must be
  `YYYY-MM-DD`; otherwise the sort is wrong.
- Company names are filled in, not ids.
- One row's status matches its `state` and `close_reason`.

Before the change, the page listed only given-up shipments.

## Open questions and follow-ups

- Run the HTTP specs (overview, validation, security) in an environment with Postgres and an
  allowed `BUSINESS_CENTRAL_DISCOVERY_URL` before merging.
