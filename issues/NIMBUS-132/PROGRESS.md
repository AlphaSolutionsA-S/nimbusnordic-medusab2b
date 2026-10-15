# NIMBUS-132: Make Login as Landing Page

- **Date:** 2026-07-15
- **Type:** Story
- **Tracker:** JIRA - https://alphasolutionsdk.atlassian.net/browse/NIMBUS-132
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-132/
- **Updated by:** scoper agent
- **Handover to:** implementation-planner agent
- **Handover prompt:** Create an implementation plan for NIMBUS-132 from the approved
  scope in issues/NIMBUS-132/SCOPE.md. Keep implementation focused on making login the
  Customer Portal landing experience in storefront routing, verify authenticated vs
  unauthenticated entry behavior, and confirm backend auth/session contracts are reused
  without functional backend changes unless strictly required. Confirm base branch before
  planning implementation.

- **Date:** 2026-07-15
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. Base branch confirmed as `develop` via `.git/HEAD`. Planning artifacts created: `PLAN.md`, `manifest.md`, `01-storefront-portal-entry-routing-implementation.md`, `02-auth-session-contract-verification-implementation.md`.
- **Handover to:** implementor agent
- **Handover prompt:** Implement NIMBUS-132 using the approved planning artifacts in `issues/NIMBUS-132/`: execute Task 01 then Task 02 in dependency order, keep changes limited to storefront routing/auth entry behavior, avoid backend functional changes unless strictly required, run `pnpm lint` and `pnpm build`, and update `issues/NIMBUS-132/PROGRESS.md` with implementation outcome and verification results.

- **Date:** 2026-07-17
- **Updated by:** codex agent
- **Outcome:** Reimplemented Task 01 storefront landing behavior by changing `apps/storefront/src/app/[countryCode]/(main)/page.tsx` to server-redirect `/{countryCode}` to `/{countryCode}/account`, restoring login-first entry flow. Confirmed no backend functional files changed. Validation commands could not be executed in this environment because `node` is unavailable (`pnpm lint` fails with `pnpm: not found: node`).
- **Handover to:** user/developer
- **Handover prompt:** Run `pnpm lint` and `pnpm build` from the repo root in a Node-enabled environment, then manually verify unauthenticated and authenticated navigation from `/{countryCode}` to `/{countryCode}/account`.

- **Date:** 2026-07-17
- **Updated by:** codex agent
- **Outcome:** Adjusted landing behavior to be auth-dependent: `/{countryCode}` now checks `retrieveCustomer()` and only redirects unauthenticated users to `/{countryCode}/account`; authenticated users now see the normal frontpage content (Hero + FeaturedProducts). No backend functional changes.
- **Handover to:** user/developer
- **Handover prompt:** Run `pnpm lint` and `pnpm build` in a Node-enabled environment, then verify: logged-out user is redirected to account/login and logged-in user sees the frontpage when opening `/{countryCode}`.

## 2026-10-15 — Merged; in Internal review
- **Updated by:** main session (status reconciliation).
- **Outcome:** The work is on `develop` (most likely commit `0e33838` "Add forgot-password and login-protected changes"; no commit carries the NIMBUS-132 key), and Jira shows NIMBUS-132 in **Internal review**.
  The earlier handover to a reviewer or PR owner is done: the code is merged. This entry records
  the current state only. It does not review or re-verify the work.
- **Handover to:** reviewer (internal review in Jira), then close with a closing comment.
