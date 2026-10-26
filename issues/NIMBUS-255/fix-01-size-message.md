# Fix brief: size label as one ICU message (gate answer 2)

**Key:** NIMBUS-255 · **Issue:** NIMBUS-257 · **App:** storefront · **Status:** DONE

## Goal

The size is shown today as `{t("sizeLabel")}: {display.size}` in
`apps/storefront/src/modules/account/templates/bc-order-detail-template.tsx` and
`apps/storefront/src/modules/account/components/bc-order-return/index.tsx`, so the `": "`
separator is hard-coded in JSX. Move the whole text into one next-intl (ICU) message with a
`{size}` argument, so each locale controls its punctuation.

## Change

- Replace `Account.bcOrderReturn.sizeLabel` with one message `Account.bcOrderReturn.size` whose
  value carries the placeholder, in all 8 locale files
  `apps/storefront/messages/{da,de,en,fr,it,no,pl,sv}.json`:
  da `Størrelse: {size}`, de `Größe: {size}`, en `Size: {size}`, fr `Taille : {size}` (French
  space before the colon; use a normal space unless the repo's fr file already uses a no-break
  space before colons, then match it), it `Taglia: {size}`, no `Størrelse: {size}`,
  pl `Rozmiar: {size}`, sv `Storlek: {size}`. Remove the old `sizeLabel` key (it was added on
  this branch, nothing else uses it).
- Both components render `t("size", { size: display.size })`; no literal separator left in JSX.
  Remove `":"` from any `react/jsx-no-literals` allow list only if this branch added it.

## Test intent

- Update the existing size assertions in
  `apps/storefront/src/__tests__/modules/account/templates/bc-order-detail-template.test.tsx` and
  `apps/storefront/src/__tests__/modules/account/components/bc-order-return/index.test.tsx` so they
  prove the size text comes from the message with its argument (e.g. "Size: XL" rendered through
  the real `en` message or the test's translation mock with the argument applied). Keep every other
  existing assertion; do not delete tests.

## Done when

- Scoped tests for the two component test files and the helper test pass; storefront lint 0
  errors; storefront typecheck at or below baseline 8.
- Each locale file still parses as JSON and contains the new key, and no file contains `sizeLabel`.

## Also update

- `issues/NIMBUS-255/branch-notes.md`: one line on the key change. No `docs/` section covers it.

## Deviations

- Test assertions left as they were: the existing `getByText("Size: XL")` / `"Size: M"` assertions
  already resolve through the real `en` message via `apps/storefront/__mocks__/next-intl.tsx`, which
  applies the `{size}` argument. With the locale files changed and the components not yet changed,
  the 3 size assertions failed (component rendered `sizeLabel: XL`); they pass only once the
  components call `t("size", { size })`. Rewriting them would have added nothing.
- French uses a normal space before the colon (`Taille : {size}`): `fr.json` already uses normal
  spaces before colons (e.g. `"Note : {notes}"`), no no-break spaces.
- No `react/jsx-no-literals` allow list change: the branch never added `":"` to one.

## Done-when evidence

- Scoped tests pass: `bc-order-detail-template.test.tsx` ("shows an invoice line's name once and
  its size", "shows an open line's name and size without repeating the size"),
  `bc-order-return/index.test.tsx` ("shows each eligible line's name once, an extra description and
  the size") and `bc-order-line-display.test.ts`: 3 suites, 23 passed. Red run before the component
  change: 3 failed, 12 passed.
- Storefront lint: 0 errors (pre-existing warnings only, none in the touched files).
- Storefront typecheck: 8 errors, baseline 8.
- All 8 `messages/*.json` parse with `JSON.parse` and contain `Account.bcOrderReturn.size`; grep for
  `sizeLabel` in `apps/storefront/messages` and `apps/storefront/src`: 0 matches.
- Both components render `t("size", { size: display.size })` with no literal separator in JSX.
- Also update: `branch-notes.md` has a fix-01 line on the key change; no `docs/` section covers it.
