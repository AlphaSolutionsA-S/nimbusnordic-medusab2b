# Next.js data layer: Nimbus Nordic

Paths under `apps/storefront/src/`. Tier 0 `layers.md` maps S0–S4 to this app.

- S2 lives in `lib/data/*.ts` (15 `"use server"` files); `lib/data/cms.ts` (Payload, with
  `PAYLOAD_API_KEY`) and `lib/data/ui-translations.ts` are `server-only` loaders.
- Fetch layout and catalog data at the route level and pass it as props; child components don't fetch.
- Server components by default; `"use client"` only for state, effects or event handlers.
- UI text: `getTranslations('Namespace')` (server) or `useTranslations('Namespace')` (client) from
  next-intl. Messages come from the backend database at runtime; `messages/*.json` are developer and
  import material only. Read `lib/i18n/README.md` before touching translations.
- Tests: Jest in `src/__tests__/` mirroring `app/`, `lib/` and `modules/`; next-intl mocks in
  `__mocks__/`. A new component gets a test file. Visual tests: Playwright in `e2e/visual/`.
- Canonical page: `app/[countryCode]/(main)/account/@dashboard/bcorders/page.tsx` with
  `modules/account/templates/bc-order-detail-template.tsx`; component test:
  `__tests__/modules/account/components/bc-order-card/index.test.tsx`.
- Formatting: Prettier (`apps/storefront/.prettierrc`: no semicolons, double quotes, es5 trailing
  commas).
- Do not copy: `app/[countryCode]/(main)/account/@dashboard/quotes/components/*` (feature code under
  `app/`); the `@ts-expect-error` in `lib/context/cart-context.tsx`; `lib/util/check-spending-limit.ts`
  (`any`, duplicates the backend rule); `ignoreBuildErrors: true` in `next.config.js`.
