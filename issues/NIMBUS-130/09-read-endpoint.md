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
