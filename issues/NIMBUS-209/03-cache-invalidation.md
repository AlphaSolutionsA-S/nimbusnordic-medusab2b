# 03: Immediate cache invalidation on the Next.js 16 APIs
**App:** storefront · **Layer:** S2 (server actions), S3 (route handler) · **Depends on:** 01

**Goal:** Replace every single-argument `revalidateTag` call with the Next.js 16 API that keeps
immediate expiry. Server actions use `updateTag` with the same tags in the same places. The
translation refresh route uses `revalidateTag(tag, { expire: 0 })`. No tag is added or removed,
and no `"max"` profile is used (plan section 6).
**Files / areas:** `src/lib/data/{cart,customer,companies,quotes,approvals,ui-translations-refresh}.ts`,
`src/app/api/translations/revalidate/route.ts`. The commented-out lines in `cart.ts` stay as they are.
**Seam contracts:** none outside this task.
**Test intent (unit, mocks of `next/cache` only):**
- Cart actions (add, update line, delete line, shipping method, payment session, promotions, place
  order, region) expire exactly the tags in plan section 6, through `updateTag`. Assert the tag
  values, not only that the function was called.
- Customer login and signout, and the approval decision, expire their tags through `updateTag`.
- The translation route, for an accepted request, calls `revalidateTag` once with
  `("ui-translations:<locale>", { expire: 0 })`. Wrong secret, oversized body, bad schema and an
  outdated version call neither function.
- `refreshUiTranslationsForCountry` expires one locale tag through `updateTag`.
- Negative: no call anywhere passes `"max"` or any profile other than `{ expire: 0 }`.
**Done when:** a search for single-argument `revalidateTag(` in `src` finds only comments, and the
changed tests pass.
**Verify after deploy:** on the preview site, add an item to the cart and check that the cart page
total updates at once. Publish a Danish translation in Admin and check that `/dk` shows the new
text on the next load.
**Also update:** `src/__tests__/lib/data/{cart,customer,approvals,ui-translations,ui-translations-refresh}.test.ts`,
`src/__tests__/app/api/translations/revalidate.test.ts`,
`src/__tests__/modules/account/components/company-card-bc-readonly.test.tsx` (its `next/cache`
mock); `ai/skills/medusa-storefront/project.md` line 9 (`revalidateTag` → `updateTag`).
