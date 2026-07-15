# Task 01: Storefront portal entry route to login-first experience

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `pnpm test` (from repo root; run only if storefront test target exists)
- **Test framework:** Jest (repo standard)
- **Test location:** Storefront currently has no dedicated Jest suite; rely on targeted manual verification + lint/build for this task.
- **Naming conventions:** `apps/storefront/copilot-instructions.md` (kebab-case dirs/files, PascalCase React components, camelCase vars/functions)

## Solution Design

Change the storefront Customer Portal entry route so country root traffic (`/[countryCode]`) no longer renders the marketing home content and instead redirects to the account entry route (`/[countryCode]/account`). This makes login the default landing experience for unauthenticated users while preserving existing authenticated account rendering via current account layout logic.

## Code Skeletons

No new files are required for this task.

## Impacted Files

- `apps/storefront/src/app/[countryCode]/(main)/page.tsx`
  - Change: route behavior from rendering home content to server-side redirect.
  - Signature (unchanged):  
    `export default async function Home(props: { params: Promise<{ countryCode: string }> })`

## Test Cases

### TC-1: Unauthenticated country-root entry lands on login
- **Given:** No auth token/session cookie.
- **When:** User opens `/{countryCode}`.
- **Then:** Route redirects to `/{countryCode}/account` and login UI is shown.

### TC-2: Authenticated country-root entry lands on account dashboard path
- **Given:** Valid authenticated customer session.
- **When:** User opens `/{countryCode}`.
- **Then:** Route redirects to `/{countryCode}/account`, and existing account layout resolves to authenticated dashboard content.

### TC-3: Existing direct deep links remain functional
- **Given:** Existing routes like `/{countryCode}/store`, `/{countryCode}/products/...`, `/{countryCode}/account/orders`.
- **When:** User opens direct links.
- **Then:** Existing behavior remains unchanged by the landing-route redirect.

## Implementation Steps

1. Update `apps/storefront/src/app/[countryCode]/(main)/page.tsx` to use `redirect` from `next/navigation` to `/${countryCode}/account`.
2. Remove now-unused home-page imports in that file (hero/featured/suspense metadata dependencies only if unused).
3. Keep function signature unchanged and preserve strict typing.
4. Run storefront lint/build validation:
   - `pnpm lint`
   - `pnpm build`
5. Manually verify TC-1..TC-3 in local dev (or preview environment) with both authenticated and unauthenticated sessions.
