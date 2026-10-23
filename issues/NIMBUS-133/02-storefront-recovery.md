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
