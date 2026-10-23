# 02: Public translated recovery
**App:** storefront · **Layer:** S2, S3, S4 · **Depends on:** 01
**Goal:** A signed-out customer requests and completes recovery on country-prefixed public pages.
**Files / areas:** src/app/[countryCode]/, modules/account/, lib/data/customer.ts, mirrored src/__tests__/ and account e2e areas.
**Seam contracts:** Consume 01 through existing SDK server actions; notification destination and reset page agree. No fetch from feature components.
**Test intent:**
- Public login entry/request/reset remain usable signed out and in another browser.
- Neutral acknowledgement, confirmation, invalid-link/fresh-request and success-to-login states without automatic login.
- Keyboard labels, password-manager fields and translated error/loading/success states.
- Existing login and signed-in password change continue; no password/token in UI errors.
**Done when:** Forms exercise backend contracts with meaningful failure checks and app checks at baseline.
**Verify after deploy:** Login entry, forgot/reset page and published UI translations in one configured country.
**Also update:** Affected account/login/profile tests; translation import material and database import checklist, never JSON as runtime translations.

## Deviations
- Recovery server actions live in a dedicated `lib/data/password-recovery.ts` rather than expanding the existing customer action file; this keeps the signed-out recovery boundary independent of login/cart cookies.
- Password policy remains backend-owned: forms describe the eight-character rule and confirmation, and render the backend's validation failure without duplicating its decision in S2/S4.
- Configured lint cannot execute in the existing install: `next lint` treats `lint` as a directory; directly invoking legacy ESLint fails on the installed Next/React flat-config circular structure. No dependencies/configuration changed to work around this environment baseline.
- Public browser navigation and another-browser completion remain task 03/deployment evidence; Jest verifies signed-out action and form behaviour without claiming a running Next/browser check.

## Done-when evidence
- Backend contracts: `src/__tests__/lib/data/password-recovery.test.ts` covers country metadata, malformed email refusal, reset-proof-only completion, missing proof, safe status mapping and provider-error sanitization (8 passed).
- Form behaviour: `src/__tests__/modules/account/components/password-recovery.test.tsx` covers neutral acknowledgement, missing/rejected proof and fresh request, password-manager labels, success to normal login, backend password-validation retry and pending disable/loading states (6 passed).
- Login regression: updated login component test verifies the country-prefixed recovery entry; existing customer data/login tests unchanged and passing. Four scoped suites total 27 passed. No automatic login action or session write is present in recovery.
- Public route evidence: pages are sibling routes outside account/dashboard guards; reset GET only passes a string query proof to the form. Browser execution not provable in this task; task 03 owns the running environment check.
- App checks: whole-app tsc remains at 58 diagnostics (baseline 58), none in touched files. Lint environment failures recorded above and in ignored run logs. Source/test files formatted with app Prettier.
- Also update account/login/profile: added recovery entry assertion; existing customer login suite passed; profile/signed-in password implementation untouched and its backend regression belongs to task 03.
- Also update translations: added all `Account.recovery` keys plus login recovery entry in eight import-material language files; `src/lib/i18n/README.md` now lists the per-environment DB merge/publication checklist. No runtime JSON import added.
- After-deploy evidence pending: published runtime translations, real mailbox delivery, old password refusal and new password login.
