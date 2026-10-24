# 01: Email-language rule
**App:** backend · **Layer:** L5 · **Depends on:** None · **Parent:** NIMBUS-162

**Goal:** One pure function choosing an email's language and link country from the request country, the company country, the countries in regions and the stored assignments; registered as the rule's home.
**Files / areas:** `apps/backend/src/workflows/transactional-email/utils/` (new), `ai/architecture/decisions.md` (then `pnpm ai:check --fix`).
**Seam contracts:** input `{ requestCountry?: unknown; companyCountry?: string | null; configuredCountries: string[]; assignments: Record<string, string> | null }` → `{ locale: string; linkCountry: string }`. Defaults `en` and `dk` as named constants; reuse `isCountryCode` from the translation module's `country-languages.ts` only if importing it keeps `bound-helper-pure` (it is a pure module file; otherwise a local check).
**Test intent:** unit (`utils/__tests__/*.unit.spec.ts`), asserting both returned fields:
- request country in a region and assigned → assigned language, that link country; unassigned → `en`, that country.
- request country absent, malformed (`../evil`, `SE`, `x`), or not in a region → falls to the company country.
- company country `" DK "` / `"dk"` in a region → used; `"Denmark"`, `"XX"`, null → `en` + `dk`.
- assignments null (not initialized) → `en` with the chosen link country.
- request country wins over a different usable company country.
**Done when:** tests pass; registry row "Email language and link country" points at this file with consumers (reset and invitation emails).
**Also update:** `ai/architecture/decisions.md` (new row); none found otherwise.
