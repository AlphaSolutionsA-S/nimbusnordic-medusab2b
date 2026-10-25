# Fix brief 03: invite card sends the country only when it is a two-letter code

**Issue:** NIMBUS-249 (task 06). Gate answer 3 (Klaus Petersen, 2026-10-25), recorded in
`deviation-report.md` (Finding 2).

## Problem

`apps/storefront/src/modules/account/components/invite-employee-card/index.tsx` sends the raw
`[countryCode]` route segment as `country_code`. The middleware accepts a segment that merely
contains a region code (for example `/dkx/account/company`), so the card can send `"dkx"`; the
backend's strict schema (`^[a-z]{2}$`) then answers 400 and no employee is created.

## Change

Test first. The card sends `country_code` only when the route segment matches `^[a-z]{2}$`; otherwise
it omits the field entirely (not `null`, not empty), so the backend falls back to the company country.
Form fields, labels and behaviour stay unchanged. No middleware change.

## Tests

In `apps/storefront/src/__tests__/modules/account/components/invite-employee-card/index.test.tsx`:
keep the existing `"se"` case; add a case where the route segment is malformed (e.g. `"dkx"`) and
assert `createEmployee` is called with the unchanged invite fields and no `country_code` key.

## Done when

Scoped tests pass (new case failed first); storefront typecheck at or below 58; storefront lint
0 errors (run with a dummy `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`; dependencies were reinstalled, so
lint now runs).

## Deviations

- The new test also asserts `Object.keys(payload)` lacks `country_code`, because Jest's
  `toHaveBeenCalledWith`/`toEqual` treat an `undefined` property as absent and would pass if the card
  sent `country_code: undefined`.
- The test file gained a `beforeEach` that clears `createEmployee` and resets `useParams` to `"se"`, plus a
  shared `fillAndSubmit` helper, so the cases stay independent. The existing `"se"` case is unchanged.
- Storefront typecheck now measures 8 errors (baseline 58): the drop comes from the dependency reinstall,
  not from this fix. None of the 8 are in the files touched here.

## Done-when evidence

- Card sends `country_code` only when the segment matches `^[a-z]{2}$`; omits the key otherwise:
  `apps/storefront/src/__tests__/modules/account/components/invite-employee-card/index.test.tsx`
  "omits the country when the route segment is not a two-letter code". It failed first: the received
  keys included `country_code`.
- Existing `"se"` case kept and passing: same file, "sends the page country with the unchanged invite fields".
- Form fields and labels unchanged: same file, "renders the extracted field labels and submit button unchanged".
- Scoped tests: 3 passed, 0 failed.
- Storefront typecheck: 8 errors (at or below 58), none in the invite card.
- Storefront lint: exit 0, 0 errors (warnings only, pre-existing, in other files), run with dummy
  `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`.
- No middleware change: `apps/storefront/src/middleware.ts` not touched.
