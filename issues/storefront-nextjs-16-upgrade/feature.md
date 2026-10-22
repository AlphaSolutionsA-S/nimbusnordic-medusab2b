# Upgrade the storefront to Next.js 16

- Tracker: Jira (NIMBUS) — Not yet filed
- Priority: Must
- Size: M
- Area: Storefront (`apps/storefront`): framework, build and deploy
- Requested by: Klaus Petersen
- Requested at: 2026-10-22T00:00:00Z

## Description
Upgrade the customer portal storefront from Next.js 15 to Next.js 16 so that it builds and deploys on
Medusa Cloud again. Customers should see no change in how the portal looks or behaves.

## Why
Medusa Cloud's storefront build now stops with "Next.js version 15.5.x is not supported by the
Next.js team": the Cloudflare packaging step (OpenNext) refuses Next.js majors whose support has
ended, and Next.js 15 support ended on 2026-10-21. Every 15.x release fails, so no storefront change
can be deployed until the framework is on Next.js 16. Overriding the check is possible but not
wanted.

## Acceptance criteria
- [ ] The storefront builds and deploys on Medusa Cloud without the unsupported-version error and
      without overriding the version check.
- [ ] Customers can browse products and categories, log in, use their account pages (orders,
      quotes, returns, approvals), add to cart and complete checkout with Stripe and PayPal as before.
- [ ] The storefront shows the customer's country and language as before, including UI text from
      the database and the CMS preview pages.
- [ ] Lint, tests and the visual tests run on the new version at or below today's baseline.

## Out of scope
- Renaming `middleware.ts` to the new `proxy.ts` convention (later follow-up; Next 16 still builds
  `middleware.ts` with a deprecation warning).
- Adopting new Next.js 16 features (Cache Components, new caching APIs) beyond what the upgrade
  requires.
- Upgrading the CMS (`apps/cms`, already on Next.js 16) or the backend.

## Open questions
- Which wrangler version does Medusa Cloud's build use? OpenNext Cloudflare warns that Next >= 16.1
  needs wrangler >= 4.59.2; if Medusa Cloud is older, pin Next 16.0.x or get Medusa Cloud to upgrade.
- Is a preview/staging deploy available on Medusa Cloud to verify the build before `develop` ships?
- Does React need to move from 19.0.5 to the version Next 16 requires as a peer?

## Mockups / references
- Build failure source: `@opennextjs/aws` 4.1.12 `dist/build/helper.js`
  (`checkNextVersionSupport`, `isNextVersionSupported`), used by `@opennextjs/cloudflare` 1.20.13.
- Previous bump: commit `bcb772d` (Next 15.5.28).

## Technical notes
Triage findings (light look, not a design):

- `package.json`: `next` and `eslint-config-next` 15.5.28; `lint` script is `next lint`, which
  Next 16 removed. Lint config is legacy `.eslintrc.js`; `eslint-config-next` 16 ships flat config,
  so lint needs migrating to the ESLint CLI with `eslint.config.*` (the `react/jsx-no-literals`
  guard for `ui-text-translated` must survive).
- `next.config.js`: `typescript.ignoreBuildErrors: true`, `images.unoptimized: true` with
  `remotePatterns`, `headers()` (CSP frame-ancestors for the CMS live preview on
  `/:countryCode/account/claims`), `next-intl/plugin`. A `webpack` dependency is listed; Next 16
  builds with Turbopack by default (a custom webpack config fails the build): check the next-intl
  plugin and any webpack hooks.
- Caching APIs: `revalidateTag` / `unstable_cache` used across `src/lib/data/*.ts` (cart, customer,
  companies, quotes, approvals, ui-translations) and `src/app/api/translations/revalidate/route.ts`;
  Next 16 changed `revalidateTag`'s signature (cache-life profile argument). Checkout and cart use
  these.
- Request APIs: `params` / `searchParams` / `cookies()` / `headers()` used in ~9 route files under
  `src/app/[countryCode]/(main)/`; Next 15 already made them async, but Next 16 removes the
  synchronous compatibility, so any sync access breaks.
- `src/middleware.ts` (Edge runtime, raw `fetch`) is kept as is for this upgrade.
- Baseline: storefront `tsc --noEmit` fails today and `next build` hides it
  (`ai/architecture/verification.md`).
