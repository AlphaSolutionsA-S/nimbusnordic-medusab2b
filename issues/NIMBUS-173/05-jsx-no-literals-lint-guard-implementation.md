# Task 05: `react/jsx-no-literals` warn-level lint guard — Implementation Plan

**Status:** DONE
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 05
**Date:** 2026-09-29
**Branch:** feature/NIMBUS-173 (from develop)
**Depends on:** Task 02, Task 03, Task 04 (they remove the literal UI text the rule would otherwise report;
the config change itself is independent)

---

## Project Environment

- **App root:** `apps/storefront`
- **Lint command:** `cd apps/storefront && pnpm lint` (`next lint`, ESLint 9 running the legacy
  `.eslintrc.js` through `eslint-config-next` 15.5.18, which already loads `eslint-plugin-react`)
- **Lint baseline on develop:** 0 errors, 2 warnings (`react-hooks/exhaustive-deps` in `cart-context.tsx:180`
  and `cart-drawer/index.tsx:107`). Both are pre-existing; leave them.
- **Test command:** `cd apps/storefront && pnpm test` (no test changes in this task)

## Solution Design

Add an ESLint `overrides` block in `apps/storefront/.eslintrc.js` that turns on `react/jsx-no-literals` at
**warn** for `src/app/**/*.tsx` and `src/modules/**/*.tsx` only, with test files excluded (decision 5).

Options:
- `noStrings: false`: only raw JSX text children are reported. Strings inside `{"…"}` expressions and
  prop values are not, so `alt={t(...)}` and existing `{"·"}` separators stay allowed.
- `ignoreProps: true`: no reports for string props (`className`, `data-testid`, …).
- `allowedStrings`: the punctuation and decorative glyphs that the codebase uses as raw JSX text today.
  The list comes from a dry run on develop. With this list and after Tasks 02–04, the rule reports
  **0 warnings**.

Dry run on develop without `allowedStrings`: 86 warnings. With the list below: exactly 8 warnings, all real
text that Tasks 02/03 remove: root `not-found.tsx` (3), `add-note-button` "Note:", `bancontact.tsx`/`ideal.tsx`
titles, and skeleton "Cart"/"Products".

## Code Skeletons

### Modified File: `apps/storefront/.eslintrc.js` (full new content)

```javascript
module.exports = {
  extends: ["next/core-web-vitals"],
  overrides: [
    {
      // NIMBUS-173: warn on new hardcoded JSX text so untranslated copy shows
      // up in review. Warn-level on purpose — never fails the build.
      files: ["src/app/**/*.tsx", "src/modules/**/*.tsx"],
      excludedFiles: ["src/__tests__/**", "**/*.test.tsx"],
      rules: {
        "react/jsx-no-literals": [
          "warn",
          {
            noStrings: false,
            ignoreProps: true,
            // Punctuation and decorative glyphs used as raw JSX text.
            allowedStrings: [
              ",", ".", ":", "-", "—", "−", "+", "*", "%", "#", "&", "(", ")",
              "x", "×", "·", "•", "...", "…", ". . .", "0",
              "••••••••", "***************",
            ],
          },
        ],
      },
    },
  ],
}
```

## Impacted Files

- `apps/storefront/.eslintrc.js`: the only file changed

## Test Cases

### TC-1: Clean run after Tasks 02–04
- **Given:** Tasks 02–04 merged on the branch
- **When:** `cd apps/storefront && pnpm lint`
- **Then:** exit code 0, no errors, and no `react/jsx-no-literals` warnings (only the 2 baseline
  `react-hooks/exhaustive-deps` warnings)

### TC-2: New hardcoded text is reported (regression guard)
- **Given:** a temporary edit adding `<p>Hello world</p>` to `src/modules/common/components/divider/index.tsx`
- **When:** `pnpm lint`
- **Then:** one `react/jsx-no-literals` **warning** for "Hello world", and exit code 0 (warn, not error).
  **Revert the temporary edit.**

### TC-3: Tests and non-UI files are not linted by the rule (edge)
- **Given:** a test file containing JSX text (for example `src/__tests__/smoke.test.tsx`)
- **When:** `pnpm lint`
- **Then:** no `react/jsx-no-literals` warning for files under `src/__tests__`

### TC-4: Allowed glyphs and expression strings do not warn
- **Given:** the existing `{"·"}` in `order-card/index.tsx` and the raw `-` in `cart-totals` (`-{" "}`)
- **When:** `pnpm lint`
- **Then:** no warnings for them

## Implementation Steps

1. Replace `apps/storefront/.eslintrc.js` with the skeleton.
2. Run `pnpm lint`. If a `react/jsx-no-literals` warning remains, it is either (a) customer-visible text that
   Tasks 02–04 missed (fix it in the right namespace, following the NIMBUS-165 rules), or (b) a new decorative
   glyph (add it to `allowedStrings` with a short reason in the PR description). Do not raise the rule to `error`.
3. Run TC-2 manually and revert.
4. Do not migrate to flat config (`next lint` deprecation is out of scope).
