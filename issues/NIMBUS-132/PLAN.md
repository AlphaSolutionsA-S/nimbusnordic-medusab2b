# NIMBUS-132: Make Login as Landing Page

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-132

## Objective
Make Customer Portal entry traffic land on the login-first account experience by default, without backend functional changes.

## Analysis
Scope review and storefront route inspection show the country root route (`apps/storefront/src/app/[countryCode]/(main)/page.tsx`) currently serves the default home experience. Redirecting that entry route to `/{countryCode}/account` is the smallest change that satisfies login-first landing behavior while preserving existing authenticated/unauthenticated account resolution in the existing account layout. Backend auth/session APIs are already consumed via storefront data layer and should remain unchanged.

## Execution Plan
1. Replace country-root page rendering with a server redirect to `/{countryCode}/account`.
2. Validate unauthenticated vs authenticated entry behavior and direct-link regressions.
3. Confirm no backend contract or functional changes are introduced; run lint/build checks.

## Decisions & Trade-offs
- Use route-level redirect at storefront entry instead of changing backend/session behavior to keep risk and scope minimal.
- Preserve existing account route guards/parallel-route logic so post-login and deep-link behavior remains stable.

## Verification
- [ ] Unauthenticated `/{countryCode}` request redirects to `/{countryCode}/account` and displays login.
- [ ] Authenticated `/{countryCode}` request redirects to `/{countryCode}/account` and resolves to dashboard/account content.
- [ ] Direct routes (store/product/account subroutes) continue to work per current guards.
- [ ] `pnpm lint` passes.
- [ ] `pnpm build` passes.
