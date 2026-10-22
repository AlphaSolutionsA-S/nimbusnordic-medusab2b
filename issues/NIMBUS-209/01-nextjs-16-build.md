# 01: Next.js 16 dependencies and a passing build
**App:** storefront · **Layer:** S3 (route files), config · **Depends on:** None

**Goal:** Pin `next` and `eslint-config-next` to 16.4.2 and make `next build` (Turbopack) pass.
Customers see no change except one: per plan decision 1 (Klaus, 2026-10-22, replacing scope rule
R4 for deep links), a signed-out visitor on a deep account link is redirected to `/<countryCode>`
by the new `@login/default.tsx`.
**Files / areas:** `apps/storefront/package.json`, root `pnpm-lock.yaml`, `tsconfig.json` and
`next-env.d.ts` (the edits Next.js makes on first build), `src/app/[countryCode]/(main)/account/@login/default.tsx`
(new), `src/app/[countryCode]/(main)/products/[handle]/page.tsx` (`params` type only).
**Seam contracts:** The `next/cache` exports `updateTag` and `revalidateTag(tag, profile)` that task
03 relies on come from this version. The lint script stays `next lint` until task 04, so between
tasks `<f> lint` may fail, because `next lint` no longer exists in Next.js 16.
**Test intent:**
- Record the storefront `tsc --noEmit` error count and the unit-suite failures before the bump. The
  count after the bump must be at or below that.
- `@login/default.tsx` (unit, `next/navigation` mocked): with `params` resolving to `dk`, it calls
  `redirect("/dk")` and renders nothing. It never calls `retrieveCustomer` and renders no account
  data.
- Negative (open redirect): a country segment that decodes to `//evil.example` or contains `/`
  produces a single-slash path on our own site (the segment is URL-encoded), never `//…`.
- Account layout (unit, extend the existing layout test if it fits): with a customer, the layout
  returns the dashboard slot, so the login default is never rendered. This is the signed-in case.
**Seam note:** a redirect thrown in a slot the layout does not render has no effect on the
response (verified in next@16.4.2, plan section 9). Do not add a customer check to the default.
- The existing unit suite runs unchanged on Next.js 16 (`next/jest`), at or below the baseline.
**Done when:** `<f> build` passes with Turbopack and no version-check override. React stays at
19.0.5. The CMS still resolves `next` 16.3.3. `@dashboard` gets a default only if the build asks
for one, and if it does, that is recorded as a deviation.
**Verify after deploy:** the preview build log shows Next.js 16.4.2. On the preview site,
`/dk/account/orders` while signed out answers with a 307 to `/dk`. The same URL signed in shows
the orders page.
**Also update:** `ai/AGENTS.md` project table (Next.js 15.5 → 16.4), then `pnpm ai:check --fix`
(regenerates `.github/copilot-instructions.md`); `ai/skills/medusa-storefront/project.md` line 3.
