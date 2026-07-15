# NIMBUS-132: Make Login as Landing Page

- **Date:** 2026-07-15
- **Status:** Scoped
- **Type:** Story
- **Tracker:** JIRA - https://alphasolutionsdk.atlassian.net/browse/NIMBUS-132
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-132/
- **Size:** S
- **Area:** Customer Portal authentication entry flow
- **Base Branch:** Expected `develop` (confirm before implementation)
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-07-15T13:58:00+02:00

## Background

The Customer Portal should open on the login experience instead of the current default
landing page so users are guided directly into authentication when entering the portal.
This story scopes the routing and entry-flow changes needed to make login the default
landing destination.

## Requirements

### Functional
- Make login the default landing experience for Customer Portal entry traffic.
- Ensure users entering the main portal entry route are directed to the login page.
- Preserve existing login functionality and integration with backend authentication.
- Preserve post-login navigation behavior unless explicitly changed during implementation.
- Keep direct links to existing routes functional according to current auth guards.

### Non-Functional
- Do not weaken authentication/session security behavior.
- Avoid regressions in existing authenticated navigation and sign-in flows.
- Keep the change limited and low-risk, focused on routing/entry behavior.

## Affected Apps

- **storefront** - Primary change area for portal entry route and login-first behavior.
- **backend** - No expected functional change; verify existing auth/session endpoints are
  consumed unchanged by storefront login flow.

## Proposed Structure

1. Identify the current storefront landing route for the Customer Portal.
2. Update storefront routing/redirect logic so portal entry resolves to login.
3. Verify behavior for both unauthenticated and authenticated users when hitting entry
   route and login route.
4. Confirm no backend API contract changes are required for this story.

## Open Questions

- Which exact route should be treated as the Customer Portal landing entry (`/` vs a
  specific portal-prefixed route)?
- Should already-authenticated users who hit the login route be redirected immediately to
  a target page (and if so, which one)?
- Should any public/non-auth pages remain directly reachable as entry points, or should
  all entry traffic be normalized to login first?

## Dependencies

- Existing storefront authentication guard/middleware behavior.
- Existing backend customer authentication/session APIs in `apps/backend`.
- No direct dependency on other NIMBUS issue files identified in this scoping step.

