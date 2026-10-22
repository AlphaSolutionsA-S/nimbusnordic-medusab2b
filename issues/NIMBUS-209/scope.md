# Upgrade the storefront to Next.js 16

**Date:** 2026-10-22
**Status:** Implemented
**Type:** Story
**Priority:** Critical (no storefront change can deploy until this ships)
**Issue:** NIMBUS-209
**Key:** NIMBUS-209
**Case folder:** issues/NIMBUS-209/
**Base Branch:** develop (work branch `feature/NIMBUS-209`)

## Background

Medusa Cloud packages the storefront for Cloudflare with OpenNext. Since 2026-10-21 OpenNext refuses
to build Next.js 15, because the Next.js team's two-year support window for 15 has ended
(`@opennextjs/aws` 4.1.12, `checkNextVersionSupport`: release date 2024-10-21 + 2 years). Every 15.x
release fails, so the storefront cannot be deployed at all. The check can be bypassed with a flag;
Klaus does not want that.

The storefront moves to Next.js 16 (latest 16.4.2). Next.js 16 is inside the same support window
until 2027-10-21, so the next forced major upgrade is due about a year from now.

The upgrade is a framework change only: customers must see the portal look and behave as today.

## Requirements

### Functional

- F1. The storefront runs on Next.js 16.4.1 or newer (16.4.2 today), with `eslint-config-next` on the
  same version.
- F2. The Medusa Cloud build passes without the unsupported-version error and without
  `--dangerouslyUseUnsupportedNextVersion` or any other override of the check.
- F3. Every customer journey behaves as before: browse products and categories, country and
  language selection, UI text from the database, log in and out, account pages (orders, BC orders,
  quotes, returns, claims, approvals, company, addresses, profile), add to cart, and checkout with
  Stripe and PayPal.
- F4. After any cart, checkout, account, company, quote or approval change, the next page the
  customer sees shows the change (no stale cart or totals; see Business rules).
- F5. The CMS live preview of the claims page still works inside the Payload admin.
- F6. A translation change published in the backend still reaches the storefront through the
  translation refresh callback, and the language switcher still loads the newest texts.
- F7. Lint runs again: Next.js 16 removed `next lint`, so the storefront `lint` script moves to the
  ESLint CLI with a flat config, keeping `next/core-web-vitals` and the `react/jsx-no-literals`
  warning on `src/app/**` and `src/modules/**` (rule `ui-text-translated`).

### Non-functional

- N1. Lint, unit tests (Jest, still through `next/jest`) and the visual tests (Playwright) pass at or
  below today's baseline; storefront `tsc --noEmit` errors are not increased by the upgrade.
- N2. No new runtime dependency beyond what Next.js 16 itself needs; no Next.js 16 features adopted
  beyond what the upgrade requires (no Cache Components, no `"use cache"`).
- N3. `src/middleware.ts` stays as it is (Edge runtime, raw `fetch`); Next.js 16 still builds it with a
  one-time deprecation warning. Adding a `proxy.ts` next to it is forbidden, because having both is a
  build error in 16.4.2.
- N4. The build uses Turbopack (the Next.js 16 default) unless the planner shows a blocker; the
  storefront has no custom webpack or Babel configuration today.

## Business rules

- R1. A customer's own change to cart, shipping, payment session, account, company, quote or approval
  data → the next read shows the new data. The stale-while-revalidate form of cache invalidation
  (`revalidateTag(tag, "max")`) is refused for these: in 16.4.2 it does not mark the action's own
  writes as revalidated, so a customer could see the old cart after adding an item or the old total
  at checkout.
- R2. Invalidation from a server action keeps immediate expiry (Next.js 16 `updateTag`, or the
  equivalent immediate form). Invalidation from a route handler, where `updateTag` throws, keeps
  immediate expiry for the one locale tag (translation refresh callback).
- R3. The translation refresh callback stays authorized by the bearer secret (`REVALIDATE_SECRET`) and
  still invalidates exactly one locale tag per accepted request; an outdated version still returns
  `revalidated: false`.
- R4. A signed-out customer opening any account page still sees the login form; a signed-in customer
  sees the dashboard; a CMS live-preview request still sees the dashboard (unchanged behaviour,
  open finding 10 stays as it is, neither widened nor fixed here).
- R5. The claims page still sends `Content-Security-Policy: frame-ancestors` limited to the storefront
  itself and the configured Payload origin (plus localhost outside production).
- R6. Only `NEXT_PUBLIC_*` environment variables reach client code after the bundler change.
- R7. Customer-facing text stays a translation key; no hardcoded copy is added to fix an upgrade
  error.

No business data is written by new code; the actor recorded on every change is the customer, as
today.

## Data model (draft)

None. No table, field, migration or stored value changes. Cache tags (cart, fulfillment, customer,
companies, quotes, approvals, ui-translations per locale) keep their names and meaning.

## Security properties (draft)

The upgrade touches checkout and cart code and the request pipeline, so these must hold unchanged.

| Property | Intended control | Trust root | Failure behaviour |
|---|---|---|---|
| Translation refresh only by the backend | Bearer secret compared in constant time, bounded body, strict schema | `REVALIDATE_SECRET` (server-only env) | 401 / 413 / 400, no invalidation |
| Claims page framed only by the CMS | `frame-ancestors` header from `next.config.js` `headers()` | `PAYLOAD_PUBLIC_URL` | Page refuses to render in a foreign frame |
| Account pages only for a signed-in customer | Account layout chooses login or dashboard from the customer session | Medusa auth cookie read server-side | Login form shown; no account data rendered |
| Region and locale routing | `src/middleware.ts` (unchanged, Edge) | Backend regions and country-language config | Redirect to a valid country path, as today |
| Server secrets stay on the server | Only `NEXT_PUBLIC_*` inlined into client bundles | Next.js env inlining | Build output contains no server secret (check in whole-branch pass) |
| Customer sees own writes in checkout | Immediate cache invalidation (R1, R2) | Next.js cache tags | Stale cart or totals would be a payment-amount risk: blocker |

Trust anchor, replay, cross-instance, CSRF and logout: unchanged by this work (server actions keep
Next.js's built-in origin check; the planner confirms 16.4.2 still applies it).

## Affected apps

- Storefront (`apps/storefront`) only. Backend, CMS (already on Next.js 16) and Medusa Cloud
  configuration are not changed.

## Proposed structure

A Story with roughly these tasks (the planner decides the final split and order):

1. Dependencies and build: bump `next` and `eslint-config-next` to 16.4.x; make `next build` pass.
   Known build-level items from the research: the account route's parallel slots `@dashboard` and
   `@login` have no `default.tsx`, and Next.js 16 fails the build for a slot without one when the
   segment has child routes (`MissingDefaultParallelRouteError`, verified in the webpack loader;
   Turbopack's check is UNVERIFIED until a build runs); Next.js 16 rewrites `tsconfig.json`
   settings on first build; the product page's `params` type is still declared synchronous (the code
   already awaits it). The unused `webpack` and Babel dev dependencies are left alone unless they
   break the build.
2. Cache invalidation: move the single-argument `revalidateTag(tag)` calls (cart, customer,
   companies, quotes, approvals, ui-translations refresh, translation refresh route) to the
   Next.js 16 forms that keep immediate expiry (R1, R2), and update the unit tests that assert them.
   Single-argument calls still work in 16.4.2 but are deprecated and log a warning per call.
3. Lint: replace `next lint` with the ESLint CLI and a flat `eslint.config.*`, keeping the
   `react/jsx-no-literals` override (F7).
4. Verification: unit tests, visual tests, lint and typecheck against the baseline; a Medusa Cloud
   build (preview environment if one exists, otherwise the `develop` deploy) and a manual smoke test of
   the journeys in F3 to F6 on the deployed site.

"Also update": `ai/AGENTS.md` (project context says Next.js 15.5), `ai/architecture/` rows that name
the Next.js version, the storefront skill `project.md` files if they mention `next lint` or 15.x,
`docs/architecture/` storefront pages, and the storefront unit tests that mock `revalidateTag`
(`src/__tests__/lib/data/{cart,customer,approvals,ui-translations,ui-translations-refresh}.test.ts`,
`src/__tests__/app/api/translations/revalidate.test.ts`).

Flow: full pipeline, confirmed. It is one app with no data-model change, but it changes the cache
invalidation behind checkout payments (an always-full-pipeline area) and is about four tasks.

## Open questions

1. Wrangler on Medusa Cloud: OpenNext Cloudflare 1.20.13 warns (does not fail) when Next.js is 16.1 or
   newer and wrangler is older than 4.59.2 (a workerd `setImmediate` fix); its peer range asks for
   wrangler `^4.148.0`. Which wrangler does Medusa Cloud's build use? Pinning Next.js 16.0.x to
   avoid this is not an option: OpenNext 1.20.13 declares support for `>=15.5.28 <16 || >=16.4.1`
   only. If Medusa Cloud is older, does Klaus ask Medusa to upgrade, or accept the risk with a smoke
   test?
2. Is a preview or staging environment available on Medusa Cloud to prove the build before `develop`
   deploys, or is the `develop` deploy itself the verification?
3. React: Next.js 16.4.2 accepts the current React 19.0.5 as a peer (`^19.0.0`), so no React upgrade is
   required. Keep React at 19.0.5 for this story (recommended, smallest change), or move to the
   latest 19.x at the same time?
4. Should the deprecation warning from `middleware.ts` (logged once per build) be accepted until the
   `proxy.ts` follow-up, and should that follow-up be registered now as its own Jira issue?

## Dependencies

- Medusa Cloud's OpenNext Cloudflare build (1.20.13, `@opennextjs/aws` 4.1.12) and its wrangler
  version (open question 1).
- `next-intl` 4.14.x already declares Next.js 16 support (`^16.0.0`); `@vercel/analytics` and
  `@payloadcms/live-preview-react` 3.90.0 have compatible peer ranges.
- Storefront baseline (`ai/architecture/verification.md`): `tsc --noEmit` fails today and
  `typescript.ignoreBuildErrors` stays on; three storefront tests fail today.

## Documentation

- [docs/architecture/store-access.md](../../docs/architecture/store-access.md) — Storefront account
  slots and the signed-out deep-link redirect to `/<cc>`; immediate cache expiry in server actions
  (updated)
- [docs/architecture/country-languages.md](../../docs/architecture/country-languages.md) — Locale tag
  expiry in the translation refresh route and action (updated)

AI base files updated: none
