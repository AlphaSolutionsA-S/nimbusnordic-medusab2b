# NIMBUS-250 analysis

Written by the main session on 2026-10-26 from the quick-fix agent's findings (the agent could not
create this file itself); Klaus Petersen asked for it.

## Reproduction

On `develop` at `1dcbfb5`:

1. `corepack pnpm install --frozen-lockfile` from the repo root ("Already up to date"; the lockfile
   did not change).
2. `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_dummy corepack pnpm --filter @b2b-starter/storefront test -- product-tabs`
3. Result: 2 of 2 tests fail in
   `apps/storefront/src/__tests__/modules/products/components/product-tabs/index.test.tsx` with
   "A React Element from an older version of React was rendered."

## Root cause

- `apps/storefront/src/modules/products/components/product-tabs/accordion.tsx` (line 4) and
  `apps/storefront/src/modules/store/components/refinement-list/options-picker/index.tsx` (line 6)
  import `@radix-ui/react-accordion`, which `apps/storefront/package.json` does not declare.
- With no local copy, the import resolves to the copy hoisted to the repo root,
  `node_modules/.pnpm/@radix-ui+react-accordion@1.2.2_…_ror24vn364zl7ybyvgwwvsidnm/`, whose `react`
  resolves to `react@18.3.1`; the storefront renders with `react@19.0.5`. Checked with
  `require.resolve` run from `apps/storefront`.
- `pnpm-lock.yaml` already holds both variants of 1.2.2: one with React 18 peers (backend Admin) and
  one with React 19 peers (through `radix-ui@1.1.2`). Which one is hoisted depends on install
  order; the tests passed before only because an earlier install hoisted a working copy.
- No lint rule catches undeclared dependencies.

## Other undeclared imports

A scan of every bare import in `apps/storefront` (`src`, `e2e`, `__mocks__` and the root config
files) against its `dependencies` and `devDependencies` found no other undeclared package.

## Not verified

Whether a production `next build` bundles the React 18 copy. Webpack resolves from the same
`node_modules`, so a build from an install with this hoisting probably would.
