# 09: GET /orderapi/shipment-notices
**App:** backend · **Layer:** L6 (route, middleware), L3/L4 (read workflow) · **Depends on:** 01, 02, 12

**Goal:** Serve a company's shipment notices after a cursor (or since a time), oldest first and paged,
in the task 01 contract. It is a pure read.
**Files / areas:**
- `apps/backend/src/api/orderapi/` (new route folder, `middlewares.ts`);
- `src/workflows/shipment-notice/` (read workflow, reusing task 12's company-resolution step).
**Seam contracts:**
- `GET /orderapi/shipment-notices?customerNumber=&after=|since=&limit=`. Task 10 calls exactly this
  path.
- Parameters:
  - `after`: decimal string, at most 15 digits;
  - `since`: ISO 8601;
  - `limit`: 1–200, default 50.
- `after` with `since` → 400; an unknown parameter → 400.
- 200 body: the task 01 envelope; `next_cursor` echoes `after` on an empty page.
- Error bodies are Medusa's `{ type, message, code? }`. An unknown customer → 404 "Customer not
  found" from task 12's step.
- Auth: its own `authenticate("user", ["api-key"])` entry for `/orderapi/shipment-notices*`.
**Test intent:**
- HTTP contract (`integration-tests/http/orderapi/shipment-notices.spec.ts`):
  - paging over 3 rows with `limit` 2 (`has_more`, `next_cursor`, then the last row);
  - `since`; the empty-page echo;
  - the field types of every notice and line field the customer uses (strings, ints, nulls).
- Validation: `after` with `since`, `limit` 0 and 201, a non-numeric `after`, an extra parameter →
  400 with the error body.
- Security (`integration-tests/http/security/security-boundaries.spec.ts`):
  - no auth → 401; a publishable key → 401;
  - company A's number never returns B's rows;
  - an unknown number → 404, and the body does not contain the number.
- Calling twice returns the same page (no side effect).
**Done when:** tests written; route body within `limit-route-body`; lint and typecheck at or below
the baseline.
**Verify after deploy:** a `GET` through the Logic App for Metz's customer number returns 200 with the
TestDK end-to-end notice.
**Also update:** `src/api/orderapi/middlewares.ts`; `security-boundaries.spec.ts`.

## Deviations

- Added: an `after` above the int4 `sequence` column's maximum (any 10–15 digit cursor) is capped
  for the query rather than passed through. Without the cap, Postgres rejects the parameter as out
  of range and the customer gets a 500. The page still echoes the cursor as sent. Covered by a unit
  case and an HTTP case.
- Stricter than the seam text: `after` must be a canonical decimal (`0` or no leading zero, at most
  15 digits) so the echoed `next_cursor` always matches the contract's cursor format. `since` must
  carry a time zone (`Z` or an offset), because the scope asks for an ISO 8601 *timestamp* and a
  local time is ambiguous. Both have 400 cases.
- Added test cases: a 16-digit `after`, a `since` without a time zone, a null `next_cursor` on an
  empty `since` page, and `previous_cursor` on a revised notice.
- Shape: the step maps rows to the envelope through the pure `utils/shipment-notice-page.ts`, so the
  step result holds no `Date` objects. Test seeding helpers shared by both specs are in
  `integration-tests/utils/shipment-notices.ts`.
- The new route types `req.validatedQuery` through `MedusaRequest`'s second generic, with no cast.
  The orders route keeps its existing `as unknown as` cast (not touched, out of scope).

## Done-when evidence

- Paging over 3 rows with `limit` 2: `integration-tests/http/orderapi/shipment-notices.spec.ts`
  "pages oldest first with has_more and next_cursor, then the last row".
- `since`: same spec, "lists notices recorded at or after since, and none from a future time".
- Empty-page echo: same spec, "echoes after on an empty page for the last cursor" and "... for a
  cursor beyond any stored one"; unit `shipment-notice-page.unit.spec.ts` "echoes after on an empty
  page ...".
- Field types of every notice and line field: same HTTP spec, "returns every notice and line field
  with the type the customer reads" (exact `toEqual` against the contract example plus integer and
  null checks); unit "maps a stored revision to the contract notice ..." parses the result with
  `ShipmentNoticeEnvelopeSchema`.
- Validation 400s (`after` with `since`, `limit` 0 and 201, non-numeric `after`, extra parameter):
  same spec, "rejects %s with 400 and Medusa's error body" (7 cases, body
  `{ type: "invalid_data", message }`).
- Security, no auth and publishable key → 401: `security-boundaries.spec.ts` "GET
  /orderapi/shipment-notices rejects no authentication with 401" and "... a publishable key ...".
  Mutation check: with the auth entry's matcher disabled, both cases fail.
- Company A never gets B's rows: same describe, "never returns another company's notices".
- Unknown number → 404 without the number: same describe, "answers an unknown customer number with
  a 404 that does not reveal it".
- No side effect: shipment-notices spec "returns the same page when called twice"; the workflow
  has one read-only step and one listing step and no writes.
- Route body within `limit-route-body`: `src/api/orderapi/shipment-notices/route.ts` handler is
  15 lines with no domain `if`.
- Lint: `pnpm --filter @b2b-starter/backend lint` 0 errors, no warnings in the touched files.
  Typecheck: 22 errors (baseline 22), none in touched files.
- Also update `src/api/orderapi/middlewares.ts`: added its own `authenticate("user", ["api-key"])`
  entry for `/orderapi/shipment-notices*` and the GET query validation entry.
- Also update `security-boundaries.spec.ts`: added the four shipment-notice cases above.
- Verify after deploy (Logic App GET for Metz's customer number): not provable in this task. It
  needs the deployed Logic App (task 10) and TestDK.
