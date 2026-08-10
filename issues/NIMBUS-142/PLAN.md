# NIMBUS-142: Create claim information page

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-142

## Objective

Deliver an authenticated `/account/claims` information page in the Customer Portal whose
content is managed in a new, dedicated Payload CMS service and server-rendered by the
storefront.

## Analysis

- The account dashboard already gates signed-out users in
  `apps/storefront/src/app/[countryCode]/(main)/account/layout.tsx` (renders `login` when
  no customer). Placing the page under `@dashboard/claims/` inherits that guard with no
  new auth code — mirroring existing `orders`/`bcorders` pages.
- Account navigation is owned by
  `apps/storefront/src/modules/account/components/account-nav/index.tsx`, with mobile
  (`LocalizedClientLink`) and desktop (`AccountNavLink`) variants and a `*-link`
  `data-testid` convention. Non-admin entries (Orders, BC Orders) are the pattern for a
  Claims entry visible to every employee.
- **No Payload exists** in the repo today: no dependency, config, collection, media, or
  integration. It must be scaffolded as a new `apps/cms` workspace app (confirmed
  placement) on a **separate Linux Azure App Service, Node.js 22**, with Azure PostgreSQL
  and Payload's Azure Blob Storage adapter.
- **Storefront has no working test infrastructure** despite `copilot-instructions.md`
  claiming Jest + RTL: no `test` script, no `jest.config`, no `__tests__/`. The backend
  has Jest, but this story touches no backend. Per the test-infrastructure gate, the
  user chose **Option B**: wire storefront Jest + RTL and test the new surface only (no
  backfill).
- The storefront already renders constrained content safely via `react-markdown`
  (`product-tabs`); the Claims renderer follows the same raw-HTML-disabled posture but
  over Payload's structured blocks, failing closed on unknown block types.

## Execution Plan

1. **Task 01 (cms):** Scaffold Payload 3 at `apps/cms` — Postgres + Azure Blob adapters,
   App Router `(payload)` route group, workspace/turbo wiring, secret-free `.env.example`.
2. **Task 02 (cms):** Define `portal-pages` (singleton `claims`, drafts/publish,
   allowlisted RichText/Image/Callout/CTA/FAQ blocks), `media` (raster allowlist, size
   limit, required alt, SVG rejected), `users` (API-key service user), least-privilege
   access, URL allowlist; Vitest coverage.
3. **Task 03 (storefront):** Wire Jest + RTL (`next/jest`), `test` script, smoke test.
4. **Task 04 (storefront):** `server-only` CMS client fetching the published Claims page
   with a server-only API key; typed mapping; null-on-failure; tests.
5. **Task 05 (storefront):** Fixed per-block renderer (fail-closed), `/account/claims`
   route + loading + customer-safe unavailable state; Azure Blob image host in
   `next.config.js`; tests.
6. **Task 06 (storefront):** Claims links in both account-nav variants (no admin gate);
   navigation tests.
7. **Task 07 (cms + storefront):** Separate Node 22 App Service, env-var matrix (no
   committed secrets), server-only storefront credentials, full security/verification
   checklist.

## Decisions & Trade-offs

- **Payload as a separate service, not native Medusa editor.** Per the finalized scope;
  the block model is reusable for future portal pages. Cost: a new service, database,
  storage, secrets, and hosting surface — accepted and owned by task 07.
- **Option B testing.** Adds genuine automated coverage for the Claims surface and lays
  the storefront Jest foundation the instructions already promise, without a repo-wide
  test backfill. Trade-off: existing untested components remain untested.
- **Fail-closed rendering + published-only reads.** Unknown blocks render nothing; the
  service user reads only `_status: published`. Drafts are reachable only via
  authenticated Payload preview. Prioritizes safety over flexibility.
- **Server-only credentials.** `PAYLOAD_API_KEY`/`PAYLOAD_API_URL` are non-`NEXT_PUBLIC_`
  and the client imports `"server-only"`, so the key can never reach the browser.
- **Parallel tracks.** CMS (01→02) and storefront (03→06) run in parallel; the storefront
  client is built against the Payload contract with mocks, converging at task 07.

## Verification

- [ ] CMS connects to Azure PostgreSQL and stores media in Azure Blob (no local prod media).
- [ ] Content admin can draft → preview → publish; storefront shows published only; drafts
      never appear on `/account/claims`.
- [ ] Media upload rejects SVG/oversize, requires alt, serves from the allowlisted host.
- [ ] `PAYLOAD_API_KEY` absent from client bundles; storefront reads server-side only.
- [ ] Every authenticated employee sees the page; signed-out access hits the login flow.
- [ ] Unknown blocks don't render; CMS outage shows the safe unavailable state.
- [ ] No Payload collection/API handles product/price/order/customer/claim data.
- [ ] `lint`, `build`, and `test` pass for `apps/cms` (Vitest) and `apps/storefront` (Jest).
