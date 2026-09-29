# Task 06: Verification (automated + manual on /dk, /de, /gb) — Implementation Plan

**Status:** PARTIAL (automated gates done; manual /dk, /de, /gb checks TC-3 to TC-9 not run: no running backend/storefront and no browser)
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 06
**Date:** 2026-09-29
**Branch:** feature/NIMBUS-173 (from develop)
**Depends on:** Task 01, 02, 03, 04, 05

---

## Project Environment

- **App root:** `apps/storefront` (dev server: `pnpm dev`, port 8000; needs the backend running and
  `.env` with `NEXT_PUBLIC_MEDUSA_BACKEND_URL` / `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`)
- **Build:** `pnpm build` (from repo root), plus `cd apps/storefront && npx tsc --noEmit -p tsconfig.json`
- **Lint:** `cd apps/storefront && pnpm lint`
- **Tests:** `cd apps/storefront && pnpm test`; root `pnpm test:unit` for the monorepo
- **Baselines:** 3 failing tests (`main-layout.test.tsx` 1, `product-tabs/index.test.tsx` 2), 10 TS errors,
  2 lint warnings. All three exist on develop and are not in scope.

## Solution Design

No new code. This task proves the fix end to end and records the evidence in `PROGRESS.md`.
If a manual check fails, fix it in the task that owns the file (01–05). Do not patch it here.

## Test Cases

### TC-1: Automated gates
- **Given:** Tasks 01–05 done
- **When:** `pnpm test`, `npx tsc --noEmit`, `pnpm lint`, `pnpm build` run
- **Then:** tests show only the 3 baseline failures, including `message-catalogs.test.ts` green for all 8 locales;
  tsc shows the same 10 errors as the baseline; lint shows 0 errors and no `react/jsx-no-literals` warnings;
  the build succeeds

### TC-2: Static greps
- **Given:** the branch
- **When:** run from `apps/storefront`:
  - `grep -rnE '"en-GB"|"en-US"' src --include=*.ts --include=*.tsx | grep -v __tests__`
  - `grep -rn "toLocaleString()" src`
  - `grep -rn "Medusa B2B Starter\|Medusa Next.js Starter\|your Medusa Store\|You purchase" src messages`
  - `grep -rn "BcTest\|bctest\|listBusinessCentralOperations" src messages`
  - `grep -rn '"altFallback": "test"' messages`
- **Then:** all empty

### TC-3: /dk manual check (Danish)
- **Given:** a logged-in B2B customer on `http://localhost:8000/dk`
- **When:** you visit the home page, store, a PDP, the cart, checkout, the account dashboard, orders, BC orders,
  returns, and an order detail
- **Then:**
  - prices look like `1.234,50 kr.` (DKK) and dates like `15.1.2026`
  - tab titles are Danish (e.g. "Kurv", "Konto", "Ordrer"); the home tab shows "Nimbus Nordic"
  - the checkout header shows "Nimbus Nordic"
  - checkout payment names show "Kreditkort" / "Betal med faktura"
  - the loading skeleton shows "Kurv" / "Produkter" (throttle the network in DevTools to see it)
  - the BC order status filter options show "Åben" / "Kladde"

### TC-4: /de manual check (German)
- **Given:** the same customer on `/de`
- **When:** same pages as TC-3
- **Then:** prices look like `1.234,50 €` (EUR region) or with the region currency in German format; tab titles are
  German ("Warenkorb", "Bestellungen"); payment "Kreditkarte" / "Kauf auf Rechnung"

### TC-5: /gb manual check (English = en-GB)
- **Given:** `/gb`
- **When:** same pages
- **Then:** GBP formats as `£1,234.50`, dates as `15/01/2026` (en-GB, not US `1/15/2026`); English titles and
  no "Medusa" template copy

### TC-6: Forced cart error toast
- **Given:** `/dk` cart page with an item, and the backend stopped (or DevTools → Network → block the
  `/store/carts/*/line-items/*` request)
- **When:** you change a quantity, then delete an item
- **Then:** Danish toasts "Kunne ikke opdatere antallet i kurven" / "Kunne ikke fjerne varen"; the browser console
  shows no raw backend text in the toast

### TC-7: Checkout error message
- **Given:** `/de` checkout, delivery step, with the backend returning an error for the shipping method (stop the backend
  right before you select the option)
- **When:** you select a delivery option
- **Then:** "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut." is shown under the options; the raw message
  appears only in the console / server log

### TC-8: Not-found pages
- **Given:** `/dk/cart` with an invalid cart cookie (or any route that calls `notFound()`), and an unmatched URL
- **When:** you open them
- **Then:** Danish heading "Siden blev ikke fundet" and the tab title in the segment case. The root not-found shows
  English when there is no country segment. (Middleware normally redirects such paths, so this is rarely
  reachable.)

### TC-9: Quote message validation
- **Given:** `/dk/account/quotes/details/<id>`
- **When:** you click "Send" with an empty message
- **Then:** "Skriv en besked." is shown

## Implementation Steps

1. Run TC-1 and TC-2 and fix regressions in the owning task.
2. Start the backend + storefront and run TC-3…TC-9. Take a screenshot per locale of cart, checkout payment
   step and the account orders list.
3. Append a dated entry to `issues/NIMBUS-173/PROGRESS.md` with: the automated results (counts vs baseline),
   the manual checklist results per locale, and any follow-ups.
4. Check the Definition of Done (`definition-of-done` skill) before opening the PR. Commit with the
   `commit-messages` convention (`NIMBUS-173: …`).
