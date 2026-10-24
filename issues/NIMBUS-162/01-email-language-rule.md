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

## Deviations

- **Needs a human decision: `pnpm ai:check` now fails on size.** The new registry row pushes the
  generated root `AGENTS.md` to 32910 bytes, over the 32768-byte Codex limit (it was 32751 before,
  17 bytes headroom; no row fits). The row is already cut to the minimum (rule name, file, verdict,
  consumers). Freeing ~150 bytes means shortening other Tier 0 text, which this task did not do
  unasked. Options: trim another row (e.g. the consumer list on the country-language row), or move
  part of Tier 0 out of the always-loaded block.
- The `en` default reuses `DEFAULT_COUNTRY_LOCALE` from `modules/storefront-translation/country-languages.ts`
  instead of a new constant: it is the same rule (an unassigned country speaks English), and a second
  constant would be a duplicate. `dk` is the new `DEFAULT_EMAIL_LINK_COUNTRY`.
- `isCountryCode` is reused from the same file (pure module, precedent
  `workflows/storefront-translation/utils/country-language-scope.ts`; `bound-helper-pure` only bans
  services, steps and the workflows SDK).
- Added cases: request country `" se "` is not trimmed (only the company value is); an inherited
  object key is not an assignment.
- Function name chosen: `chooseEmailLanguage(input)`; types `EmailLanguageInput`, `EmailLanguage`.
  Input type matches the seam contract (`assignments` typed as `CountryLanguageAssignments`, which is
  `Record<string, string>`).

## Done-when evidence

- Tests pass: `apps/backend/src/workflows/transactional-email/utils/__tests__/email-language.unit.spec.ts`
  (22 passed), covering every test-intent bullet:
  - assigned / unassigned request country: "uses the assigned language of a request country…",
    "uses English for an unassigned request country…".
  - absent / malformed / not in region → company: "falls to the company country when the request
    country is %p" (undefined, null, `../evil`, `SE`, `x`, 42, `gb`).
  - company `" DK "` / `"dk"` used; `"Denmark"`, `"XX"`, null → `en` + `dk`: "uses company country
    %p once trimmed and lower-cased", "gives English and the dk link when company country %p is unusable".
  - assignments null: "uses English with the chosen link country when assignments are not initialized".
  - request wins: "prefers a usable request country over a different usable company country".
- Registry row: `ai/architecture/decisions.md` row "Email language and link country (NIMBUS-162)"
  → `B/workflows/transactional-email/utils/email-language.ts`, consumers reset and invitation emails;
  `pnpm ai:check --fix` regenerated `AGENTS.md` and `.github/copilot-instructions.md` but reports the
  size problem above.
- Also update `ai/architecture/decisions.md`: row added (above).
