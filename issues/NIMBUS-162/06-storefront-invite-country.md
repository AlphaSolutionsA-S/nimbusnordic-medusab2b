# 06: Storefront invite card sends the page country
**App:** storefront · **Layer:** S4, S2 · **Depends on:** 04 · **Parent:** NIMBUS-242

**Goal:** The "Invite employee" form sends the current page's country with the unchanged fields, so the invitation uses that country's language and login link.
**Files / areas:** `src/modules/account/components/invite-employee-card/index.tsx`; `src/lib/data/companies.ts` (`createEmployee`); `src/types/company/http.ts` (`StoreCreateEmployee.country_code?: string`). Pattern: `src/lib/data/password-recovery.ts` passes the country the same way.
**Seam contracts:** body field `country_code` as defined in 04.
**Test intent:** unit (`src/__tests__/modules/account/components/invite-employee-card/index.test.tsx`, Jest): submitting on `/se/...` calls `createEmployee` with `country_code: "se"` and the same other fields as today; labels and fields unchanged (existing case).
**Done when:** tests, lint and typecheck (at or below baseline) pass.
**Also update:** the existing invite-card test; none found otherwise.

## Deviations

- `src/lib/data/companies.ts` (`createEmployee`) not changed: it already forwards every field except `company_id` as the request body, so the type change alone carries `country_code`.
- The country comes from the route via `useParams<{ countryCode: string }>()` in the card (client component), the pattern `lib/context/cart-context.tsx` uses; not from a server-action argument as in `password-recovery.ts`, because `createEmployee` takes a data object rather than `FormData`.
- No client-side `^[a-z]{2}$` check: the backend's store validator (task 04) rejects anything else, and the `[countryCode]` segment is the value every other storefront call already uses.
- Lint not run: environment error. `next lint` fails ("Invalid project directory ... \lint") because the installed `next` is 16.4.2 while `apps/storefront/package.json` pins 15.5.28; running `eslint` directly fails to load the config (flat: outdated `jiti`; `.eslintrc.js`: circular plugin config). Needs a `pnpm install` matching the lockfile, then a lint run.

## Done-when evidence

- Tests pass: `src/__tests__/modules/account/components/invite-employee-card/index.test.tsx` "sends the page country with the unchanged invite fields" (submits on `countryCode: "se"`, asserts `createEmployee` called with the same seven fields as before plus `country_code: "se"`) and "renders the extracted field labels and submit button unchanged"; `src/__tests__/app/company-page.test.tsx` still passes.
- Typecheck at or below baseline: `exec tsc --noEmit` 58 errors, baseline 58; none in the touched files (the `src/lib/data/companies.ts` `revalidateTag` errors are in the baseline, file untouched).
- Lint: not provable in this task: lint tooling broken in the local install (see Deviations).
- Also update, existing invite-card test: extended with the submit case and a `next/navigation` `useParams` mock; the labels case unchanged.
