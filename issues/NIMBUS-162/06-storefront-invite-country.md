# 06: Storefront invite card sends the page country
**App:** storefront · **Layer:** S4, S2 · **Depends on:** 04 · **Parent:** NIMBUS-242

**Goal:** The "Invite employee" form sends the current page's country with the unchanged fields, so the invitation uses that country's language and login link.
**Files / areas:** `src/modules/account/components/invite-employee-card/index.tsx`; `src/lib/data/companies.ts` (`createEmployee`); `src/types/company/http.ts` (`StoreCreateEmployee.country_code?: string`). Pattern: `src/lib/data/password-recovery.ts` passes the country the same way.
**Seam contracts:** body field `country_code` as defined in 04.
**Test intent:** unit (`src/__tests__/modules/account/components/invite-employee-card/index.test.tsx`, Jest): submitting on `/se/...` calls `createEmployee` with `country_code: "se"` and the same other fields as today; labels and fields unchanged (existing case).
**Done when:** tests, lint and typecheck (at or below baseline) pass.
**Also update:** the existing invite-card test; none found otherwise.
