# Task 02: Auth/session contract verification and release checks

## Project Environment

- **App root:** `apps/storefront` (primary), `apps/backend` (read-only verification)
- **Build command:** `pnpm build` (from repo root)
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `pnpm test` (from repo root, if relevant task pipeline exists)
- **Test framework:** Jest
- **Test location:** Existing app test locations only; no new test harness introduction in this issue.
- **Naming conventions:** `apps/storefront/copilot-instructions.md` and `apps/backend/copilot-instructions.md`

## Solution Design

Validate that the landing-route change reuses existing Medusa auth/session behavior without backend functional modifications. Confirm storefront still uses existing customer authentication/session flow and that no backend API contracts require updates.

## Code Skeletons

No new files are required for this task.

## Impacted Files

- No backend functional files are expected to change.
- Optional storefront-only touch-ups are allowed **only** if needed to keep routing behavior consistent with Task 01.

## Test Cases

### TC-1: Backend remains unchanged
- **Given:** The issue scope forbids backend functional changes unless strictly required.
- **When:** Implementation is complete.
- **Then:** No backend module/API contract changes are present; storefront login/session calls continue to use current contracts.

### TC-2: Existing login and session lifecycle still works
- **Given:** Current auth flow in storefront (`sdk.auth.login`, customer retrieval, signout).
- **When:** User logs in, refreshes account routes, and logs out.
- **Then:** Session behavior remains unchanged and user flow is intact.

### TC-3: Regression check for account entry points
- **Given:** Routes `/{countryCode}/account` and deep account routes.
- **When:** User navigates with and without session.
- **Then:** Guards/parallel-route behavior remains unchanged from pre-issue behavior, except root entry now redirects into account/login-first experience.

## Implementation Steps

1. Verify Task 01 implementation does not require backend API or session contract changes.
2. Confirm storefront auth/session integration is still using existing data layer contracts (no new backend endpoints).
3. Run repo validation commands:
   - `pnpm lint`
   - `pnpm build`
4. Execute manual verification for TC-1..TC-3 and capture results in PR/implementation notes.
5. If unexpected backend dependency appears, stop and request approval before any backend functional edits.
