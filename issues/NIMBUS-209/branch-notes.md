# Branch notes: NIMBUS-209

## Task 01 (Next.js 16 build)

- `next` / `eslint-config-next` 16.4.2 installed in `apps/storefront/node_modules`; root
  `node_modules/next` is the CMS's 16.3.3 (hoisted), so read storefront sources from
  `apps/storefront/node_modules/next/dist/...`.
- Typecheck after task 01 is 58: the 8 baseline errors plus 50 TS2554 on single-argument
  `revalidateTag` (cart.ts 25, customer.ts 13, companies.ts 5, quotes.ts 3, approvals.ts 2,
  ui-translations-refresh.ts 1, `app/api/translations/revalidate/route.ts` 1). Task 03 should
  bring it back to 8.
- `next build` needs a backend at `localhost:9000` (collections `generateStaticParams` has no
  try/catch). Without one, start the stub: `node <run scratchpad>/stub-backend.js` (answers every
  request with empty lists), and set `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` (any value).
- Jest also needs `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` set (`next/jest` loads `next.config.js`).
- Unit baseline after the bump: 4 failing tests in main-layout, money, product-tabs (same as
  before the bump).
- `<f> lint` fails until task 04 (`next lint` is gone).
- The first build rewrote `tsconfig.json` (`jsx: react-jsx`, `.next/dev/types/**/*.ts` include,
  array reformatting) and `next-env.d.ts` (imports `routes.d.ts`, `root-params.d.ts`); committed as
  generated.
- Product page `Props.params` is now a `Promise`; tests pass `Promise.resolve({...})`.

## Task 02 (checkout search params)

- `Checkout` page (`app/[countryCode]/(checkout)/checkout/page.tsx`) now takes a required
  `searchParams: Promise<...>` and awaits it; tests call `Checkout({ searchParams: Promise.resolve({...}) })`.
- Storefront Jest config has `clearMocks: true`, so `toHaveBeenCalledWith` assertions are per test.
- Typecheck after task 02 is still 58, identical set to `tsc-after-01.txt` (`tsc-after-02.txt` in
  the run scratchpad).

## Task 03 (cache invalidation)

- Server actions in `lib/data/{cart,customer,companies,quotes,approvals,ui-translations-refresh}.ts`
  import `updateTag` from `next/cache`; the translation route calls
  `revalidateTag(tag, { expire: 0 })`. In 16.4.2 `revalidateTag(tag: string, profile)` requires the
  profile, so a new single-argument call fails typecheck (TS2554).
- Typecheck after task 03 is 8, the same set as `tsc-baseline.txt` (`tsc-after-03.txt`). Note:
  PowerShell `Out-File` writes a BOM, so strip it before diffing the first line.
- Test mocks of `next/cache` must provide `updateTag` for any module importing `lib/data/*`
  actions. `cart.test.ts` and `approvals.test.ts` now mock `getCacheTag` as identity
  (`async (tag) => tag`), so assertions read tag names.
- Changed `.ts` files are LF in the working tree (git warns it will convert to CRLF); no
  whole-file churn.

## Task 04 (ESLint flat config)

- `apps/storefront/eslint.config.mjs` spreads `eslint-config-next/core-web-vitals` (same shape as
  `apps/cms/eslint.config.mjs`) plus the `react/jsx-no-literals` block; `.eslintrc.js` is removed.
- `lint` is `eslint src`; it no longer loads `next.config.js`, so no publishable key is needed.
- `apps/storefront/eslint-suppressions.json` holds the 23 pre-existing React Compiler errors. Paths
  in it are relative to `apps/storefront`; run ESLint from there (the `<f>` filter does). Fixing a
  suppressed finding leaves a stale entry: prune with `eslint src --prune-suppressions`.
- Lint result: 0 errors, 3 warnings (2 `exhaustive-deps`, 1 `no-location-assign-relative-destination`).
- `AGENTS.md` is at 32761 bytes, 7 under the Codex limit `ai:check` enforces: any Tier 0 addition
  needs a matching cut.
