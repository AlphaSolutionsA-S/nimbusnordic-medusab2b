# 02: Storefront request type drops `customer_id`
**App:** storefront · **Layer:** shared type used by S2 (`lib/data/companies.ts`) · **Depends on:** None

**Goal:** the storefront's `StoreCreateEmployee` type no longer declares `customer_id`, matching the store contract after task 01. No runtime change.
**Files / areas:** `apps/storefront/src/types/company/http.ts`.
**Seam contracts:** same request body as task 01; leave the other optional fields as they are (the invite card always sends email and password).
**Test intent:**
- No test: a type-only change; the storefront typecheck is the check.
**Done when:** no storefront reference to `customer_id` on this type; storefront lint clean and typecheck at or below baseline.
**Also update:** none found (no storefront test or doc mentions it).

## Deviations

None. (Environment note, not a code change: `next lint` exits early unless
`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` is set, so lint ran with a placeholder value for that process.)

## Done-when evidence

- No storefront reference to `customer_id` on this type: the field is removed from `StoreCreateEmployee` in `apps/storefront/src/types/company/http.ts`; a search of `apps/storefront/src` for `customer_id` finds only cart, quote and test hits unrelated to this type, and the only user of the type (`createEmployee` in `lib/data/companies.ts`) never set it.
- Storefront lint clean: `corepack pnpm --filter @b2b-starter/storefront lint` exited 0.
- Typecheck at or below baseline: 8 errors, baseline 8; the same errors at the same locations (one message prints the object's properties in a different order).
- Test intent: no test, a type-only change; the typecheck is the check.
- Also update: none found, confirmed (no storefront test or doc mentions `customer_id` on this type).
