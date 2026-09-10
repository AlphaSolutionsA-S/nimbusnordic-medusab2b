# Task 06 — Validation, tests & migration verification

**App:** backend + storefront
**Depends on:** 01, 02, 03, 04, 05
**Base branch:** `develop`

## Goal
Run the full focused test/build matrix and verify the generated migration on a disposable database
before the work is considered done.

## Steps

### 1. Backend module tests (BC service + workflow)
```
pnpm --filter @b2b-starter/backend test:integration:modules
```
Confirms Task 01 `getCustomer` coverage and Task 03 workflow coverage pass.

### 2. Backend integration HTTP test (sync route)
```
pnpm --filter @b2b-starter/backend test:integration:http
```
Confirms Task 04: unauthenticated request rejected, authenticated actor resolves its own company,
expected BC failure returns `failed`, and unexpected backend failure remains non-2xx.

### 3. Backend build (type-check)
```
pnpm --filter @b2b-starter/backend build
```
Confirms the DTO/model/workflow/route type changes compile.

### 4. Storefront tests + build
```
pnpm --filter <storefront-package> test
pnpm --filter <storefront-package> build   # or the repo's type-check
```
Confirms Task 05 helper coverage and the modified login data layer type-check.

### 5. Migration verification on a disposable DB
- Apply the generated company migration (`npx medusa db:migrate` against a throwaway/test DB).
- Verify on a pre-existing `company` row:
  - `blocked = 'not_blocked'` (unblocked default),
  - `credit_limit IS NULL` and `raw_credit_limit IS NULL` (unknown until first sync),
  - `vat_number IS NULL`.
- Verify the migration `down` cleanly drops `blocked`, `credit_limit`, `raw_credit_limit`, and
  `vat_number`.

### 6. Sandbox BC end-to-end sanity (if a BC sandbox is available)
Exercise a BC customer that has: two address lines, `blocked = "_x0020_"`, a decimal
`creditLimit`, a `taxRegistrationNumber`, and an expanded `currency`. Confirm after login:
- `address` is `"<line1>, <line2>"`,
- `blocked` is `"not_blocked"`,
- `credit_limit` retains the exact decimal (no minor-unit/integer corruption),
- `vat_number` is set,
- `currency_code` equals the expanded `currency.code`,
- `logo_url`, `spending_limit_reset_frequency`, employees, customer group, and approval settings
  are unchanged.

## Acceptance gate (from SCOPE.md "Definition of done")
- [ ] Every successful explicit portal login awaits token persistence and then makes exactly one
      best-effort sync attempt before later customer/cart work.
- [ ] A valid BC customer updates exactly the approved fields with the specified address, blocked,
      decimal, VAT, and currency mappings.
- [ ] Missing mappings, no BC match, invalid BC data, and BC outages preserve company data and do
      not fail authentication.
- [ ] Unexpected backend errors remain observable as endpoint failures but are non-fatal to the
      already-completed storefront login.
- [ ] Company authority is derived only from authenticated customer membership.
- [ ] The generated migration applies to existing rows without data loss and is reversible.
- [ ] Focused service, workflow, route, storefront, migration, and build validation passes.
- [ ] No credentials, tokens, raw headers, full BC responses, or unnecessary PII appear in logs or
      responses.

## Notes
- Resolve `<storefront-package>` from `apps/storefront/package.json` `name` before running the
  storefront commands.
