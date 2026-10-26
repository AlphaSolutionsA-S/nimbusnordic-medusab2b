# Product page tabs may use the wrong React version

- Tracker: Jira (NIMBUS) — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-250 (parent epic NIMBUS-206)
- Severity: Major
- Area: Storefront, product page tabs (`apps/storefront/src/modules/products/components/product-tabs/`)
- Reported by: Klaus Petersen
- Reported at: 2026-10-26

## Summary
The tabs on the storefront product page (description and specifications) rely on a component library
that the storefront does not declare as its own dependency. Depending on how the project is
installed, the storefront can pick up a copy built for an older React version than the one the
storefront uses. After a clean reinstall, the automated tests for the product tabs fail because of
this mismatch. It has not been confirmed whether the live product page is affected, but the same
mix-up can happen in a build.

## Steps to reproduce
1. From the repo root: `corepack pnpm install --frozen-lockfile`.
2. `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_dummy corepack pnpm --filter @b2b-starter/storefront test -- product-tabs`

## Expected
Both `ProductTabs` tests pass.

## Actual
Both fail: "A React Element from an older version of React was rendered. This is not supported."

## Environment
- OS: Windows 11, Node 22, pnpm via corepack
- Build / commit: reproduced on `feature/NIMBUS-162` (2026-10-26). That branch changes nothing the
  test depends on (lockfile, package.json files, jest config, product components and their tests are
  identical to `develop` at 13e861e).
- The tests passed before the reinstall, when a Next.js 16.4.2 install was present (likely left from
  NIMBUS-209 work).

## Evidence
- `apps/storefront/src/modules/products/components/product-tabs/accordion.tsx` imports
  `@radix-ui/react-accordion`, which is not in `apps/storefront/package.json`.
- It resolves from the storefront to the root hoisted copy
  `node_modules/.pnpm/@radix-ui+react-accordion@1.2.2_…/`, whose `react` resolves to
  `node_modules/.pnpm/react@18.3.1`. The storefront itself uses `react@19.0.5`.
- `pnpm-lock.yaml` holds two variants of `@radix-ui/react-accordion@1.2.2`, one with React 18.3.1
  peers (the backend Admin) and one with React 19.0.5.
- Likely fix: declare `@radix-ui/react-accordion` in the storefront's `package.json` so it gets the
  React 19 variant. Check other undeclared imports in the storefront the same way.

## Analysis
*(Leave empty initially. Fill in `analysis.md` when investigation starts and link from here.)*
