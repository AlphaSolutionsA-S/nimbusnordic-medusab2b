# Task 04: Extract Account/Auth Strings (Login, Register) — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 04
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-165 (from develop)
**Depends on:** Task 01 (namespace convention), NIMBUS-163 (translation pattern + message catalogs)

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build`
- **Lint command:** `pnpm lint`
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library
- **Test location:** `apps/storefront/src/__tests__/modules/account/`
- **Naming conventions:** per `apps/storefront/copilot-instructions.md`

## Solution Design

Extract strings from `apps/storefront/src/modules/account/components/login/index.tsx` and
`register/index.tsx`. Both are Client Components (interactive forms) — use `useTranslations`.

**Login** (`login/index.tsx`), exact strings from exploration:
- Lines 22–25: `"Log in for faster<br/>checkout."` → `Account.login.heading` (note the `<br/>` —
  use next-intl's rich-text formatting (`t.rich`) rather than injecting raw HTML into a translated
  string, so translators/MT in NIMBUS-167 don't need to embed markup)
- Line 30: `label="Email"` → `Account.login.emailLabel`
- Line 33: `title="Enter a valid email address."` → `Account.login.emailValidationMessage`
- Line 50: `"Remember me"` → `Account.login.rememberMeLabel`
- Line 57: `"Log in"` → `Account.login.submitLabel`
- Line 65: `"Register"` → `Account.login.registerLinkLabel`

**Register** (`register/index.tsx`), exact strings from exploration (lines 117–198, `label=`
values):
- `"First name"` → `Account.register.firstNameLabel`
- `"Last name"` → `Account.register.lastNameLabel`
- `"Company name"` → `Account.register.companyNameLabel`
- `"Company address"` → `Account.register.companyAddressLabel`
- `"Company city"` → `Account.register.companyCityLabel`
- `"Company state"` → `Account.register.companyStateLabel`
- `"Company zip"` → `Account.register.companyZipLabel`

## Code Skeletons

### Modified File: `apps/storefront/src/modules/account/components/login/index.tsx` (excerpt)

```tsx
'use client'
import { useTranslations } from 'next-intl'
// ...existing imports...

export function Login(/* ...existing props... */) {
  const t = useTranslations('Account.login')
  // ...existing state/handlers unchanged...

  return (
    <div>
      {/* was: "Log in for faster<br/>checkout." */}
      <h1>{t.rich('heading', { br: () => <br /> })}</h1>

      {/* was: label="Email" title="Enter a valid email address." */}
      <Input label={t('emailLabel')} title={t('emailValidationMessage')} />

      {/* was: "Remember me" */}
      <label>{t('rememberMeLabel')}</label>

      {/* was: "Log in" */}
      <Button type="submit">{t('submitLabel')}</Button>

      {/* was: "Register" */}
      <a>{t('registerLinkLabel')}</a>
    </div>
  )
}
```

### Added keys: `apps/storefront/messages/en.json` (merge)

```json
{
  "Account": {
    "login": {
      "heading": "Log in for faster<br></br>checkout.",
      "emailLabel": "Email",
      "emailValidationMessage": "Enter a valid email address.",
      "rememberMeLabel": "Remember me",
      "submitLabel": "Log in",
      "registerLinkLabel": "Register"
    },
    "register": {
      "firstNameLabel": "First name",
      "lastNameLabel": "Last name",
      "companyNameLabel": "Company name",
      "companyAddressLabel": "Company address",
      "companyCityLabel": "Company city",
      "companyStateLabel": "Company state",
      "companyZipLabel": "Company zip"
    }
  }
}
```

> **Worker note:** `t.rich`'s tag syntax requires `<br></br>` (self-closing tags aren't valid in
> ICU rich-text syntax) — verify the exact syntax against the installed next-intl version's docs.
> Add the identical `Account` block (English content) to all 8 locale files.

## Impacted Files

- `apps/storefront/src/modules/account/components/login/index.tsx`: replace strings at lines
  22–25, 30, 33, 50, 57, 65 as shown.
- `apps/storefront/src/modules/account/components/register/index.tsx`: replace the 7 `label=`
  strings at lines 117–198 as shown, plus read the full file for any other hardcoded strings
  (submit button text, headings) not caught during exploration.
- `apps/storefront/messages/{da,en,sv,no,pl,it,fr,de}.json`: add `Account` namespace.
- `issues/NIMBUS-165/extraction-checklist.md`: check off `modules/account` (partial —
  this task covers login/register only; dashboard/addresses/orders sub-areas are covered in
  Task 05's sweep).

## Test Cases

### TC-1: Login form renders extracted strings unchanged
- **Given:** the `en` locale is active
- **When:** `Login` renders
- **Then:** the heading, email label/validation message, "Remember me", "Log in", and "Register"
  text all match pre-extraction content exactly

### TC-2: Rich-text heading renders the line break correctly
- **Given:** the `en` locale is active
- **When:** `Login` renders its heading via `t.rich('heading', ...)`
- **Then:** the rendered DOM contains a `<br>` element between "Log in for faster" and "checkout."
  (not a literal `<br/>` string)

### TC-3: Register form labels render extracted strings unchanged
- **Given:** the `en` locale is active
- **When:** `Register` renders
- **Then:** all 7 field labels match pre-extraction content exactly

## Implementation Steps

1. Read `login/index.tsx` and `register/index.tsx` in full to confirm current line numbers and
   catch any hardcoded strings not enumerated above (e.g. submit button on register form).
2. Apply `useTranslations('Account.login')` / `useTranslations('Account.register')` and replace
   each hardcoded string, using `t.rich` for the login heading's embedded line break.
3. Add the new keys to all 8 message catalogs with identical English content.
4. Add/update tests for TC-1–TC-3.
5. Manually verify login/register flows still function end-to-end in dev.
6. Update `extraction-checklist.md`.
7. Run `pnpm lint`, `pnpm test`, `pnpm build`.
