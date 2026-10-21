# Manifest: Protect company-linked carts from access by cart ID alone

**Key:** NIMBUS-177
**Issue:** NIMBUS-177
**Branch:** feature/NIMBUS-177 (from develop)
**Ready for Dispatch:** true

## Conventions and commands
- Backend (`@b2b-starter/backend`): scoped unit `pnpm --filter @b2b-starter/backend test:unit -- <path>`;
  HTTP contract `pnpm test:integration:http` (local Postgres, disposable DBs,
  `BUSINESS_CENTRAL_DISCOVERY_URL` set to an allowed test environment); lint
  `pnpm --filter @b2b-starter/backend lint`; typecheck `apps/backend/node_modules/.bin/tsc --noEmit`
  (Windows: call it directly). Unit tests in `src/**/__tests__/*.unit.spec.ts`; security HTTP cases in
  `apps/backend/integration-tests/http/security/security-boundaries.spec.ts`.
- Storefront (`@b2b-starter/storefront`): `pnpm --filter @b2b-starter/storefront test -- <path>`, lint,
  `exec tsc --noEmit`. Tests in `src/__tests__/` mirroring `lib/`, `modules/`, `app/`. UI text through
  next-intl keys added to `messages/*.json`.
- Typecheck and some tests fail on develop today; each task stays at or below the baseline
  (`ai/architecture/verification.md`). Integration suite and builds run once at finalization.
- No migrations, no new modules. The cart-access rule has one home (task 01); nothing else re-derives it.

## Tasks
`F<n>` is functional requirement n in `scope.md`; NFR is its non-functional list.

| # | Title | File | App | Implements | Depends on | Issue | Status |
|---|-------|------|-----|------------|------------|-------|--------|
| 01 | Cart access decision and authorization workflow | `01-cart-access-decision.md` | backend | F1, F4, F6 (read vs edit), business rules (owner, colleague, admin, membership loss, ambiguous) | None | NIMBUS-199 | DONE |
| 02 | Trusted company link at cart creation | `02-trusted-cart-company-link.md` | backend | F2 (creation), F4, F7 (sign-in to create), finding 8 for carts | None | NIMBUS-200 | DONE |
| 03 | Guard on every direct and indirect cart route | `03-cart-route-guard.md` | backend | F1, F2, F3, F5 (no claim by ID), F6, NFR fail closed, cross-instance, no shared caching | 01, 02 | NIMBUS-201 | TODO |
| 06 | Order access decision and guard; transfer request and cancel return no order; account-owned orders not transferable | `06-order-access-guard.md` | backend | F3 extended to store order-by-ID routes (decisions 3–7), NFR fail closed | 01, 03 | NIMBUS-204 | TODO |
| 07 | Approval list and decisions respect the verified association | `07-approval-routes-association.md` | backend | F3 (approval IDs), F6, business rule "ambiguous carts refused" | 01 | NIMBUS-205 | TODO |
| 04 | Storefront sign-in, cart lifecycle and messages | `04-storefront-cart-lifecycle.md` | storefront | F5, F7, F8 (old cookies), NFR logout/account switch and caching (carts and orders) | 02, 03 | NIMBUS-202 | TODO |
| 05 | Document cart access rules and rollout | `05-document-cart-access.md` | docs | F8 (rollout procedure), NFR documentation (carts and orders) | 02, 03, 04, 06, 07 | NIMBUS-203 | TODO |

## Scope items with no task
| Scope item | Reason (already done / external / not needed) |
|---|---|
| Trusted recovery of ambiguous carts | Not needed: decision 1 answered (customers start a new cart) |
| Order transfer accept and decline (token-gated) | Not needed: the token is in no store response and nothing sends it; residual risk recorded in plan section 10 |
| Server-assigned `handled_by` (F6, last rule) | Already done (`validate-company-approval.ts`); association check added in 07 |
| Public product, region and general shipping-option discovery | Not changed by design (F3) |
| Framework browser/CSRF controls | Already provided by Medusa and Next.js (plan section 9); no code change |
| Token revocation redesign | Outside scope (scope non-functional note); limit stated in 05 |
