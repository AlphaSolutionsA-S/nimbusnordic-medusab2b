# NIMBUS-250: Declare @radix-ui/react-accordion in the storefront

## Summary

After a clean install, the storefront product-tabs tests failed with "A React Element from an older
version of React was rendered". The storefront imports `@radix-ui/react-accordion` (product page
tabs and the store page refinement filters) without declaring it, so the import resolved to
whichever copy pnpm hoisted to the repo root. After this install that was the variant bound to
`react@18.3.1` (the backend Admin's), while the storefront renders with `react@19.0.5`. The
storefront now declares the package, so it always gets the React 19 variant that `pnpm-lock.yaml`
already held. No source code changed. Reproduction and root cause: `analysis.md`.

## What was built

- `apps/storefront/package.json`: `"@radix-ui/react-accordion": "^1.2.2"` added to `dependencies`.
- `pnpm-lock.yaml`: one storefront importer entry (3 lines) pointing at the existing
  `1.2.2(...react-dom@19.0.5(react@19.0.5))(react@19.0.5)` variant. No package or snapshot entries
  changed, so no new package enters the install.

## Decisions

- Caret range `^1.2.2`, matching the manifest's other entries, rather than an exact pin. pnpm reused
  the locked 1.2.2, so the pin the plan held in reserve was not needed.
- No lint rule (`import/no-extraneous-dependencies`) added to stop undeclared imports recurring;
  confirmed by Klaus Petersen as out of scope for this fix.
- A scan of every bare import in `apps/storefront` found no other undeclared package, so nothing
  else was declared.

## Tests

- Reproducing test: `apps/storefront/src/__tests__/modules/products/components/product-tabs/index.test.tsx`
  failed 2/2 before the change and passes 2/2 after a `--frozen-lockfile` install.
- Resolution check (one-off, from `apps/storefront`): the accordion now resolves through
  `apps/storefront/node_modules` to the React 19 variant, and its `react` is `react@19.0.5`, the
  same copy the storefront uses.
- No existing test renders the store refinement-list options picker (the tests touching the
  refinement list mock it); the refinement-list folder tests (3 suites, 4 tests) pass.
- Full storefront suite: 593 of 595 pass. The two failures, `app/main-layout.test.tsx` (promo-banner
  copy) and `app/profile-page.test.tsx` ("Security" heading), are text lookups that do not involve
  the accordion; they are outside this change and in line with the storefront failures the
  verification baseline records.
- Typecheck 8 errors and lint 0 errors / 2 warnings, both equal to the baseline taken before the
  change.

## Verify after deploy

A storefront product page with a description and specifications: the tabs open and close and the
browser console shows no React error. Also a store page with refinement filters (the options
picker uses the same component). Before value not read. Not checked locally: whether a production
`next build` from the old install would have bundled the React 18 copy.

## Open questions and follow-ups

- Whether to add an undeclared-dependency lint rule for the storefront (and the other apps), so
  this class of defect fails in lint instead of after a reinstall.
- The two failing storefront suites above, if they are not already tracked.
