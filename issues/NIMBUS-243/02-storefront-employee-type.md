# 02: Storefront request type drops `customer_id`
**App:** storefront · **Layer:** shared type used by S2 (`lib/data/companies.ts`) · **Depends on:** None

**Goal:** the storefront's `StoreCreateEmployee` type no longer declares `customer_id`, matching the store contract after task 01. No runtime change.
**Files / areas:** `apps/storefront/src/types/company/http.ts`.
**Seam contracts:** same request body as task 01; leave the other optional fields as they are (the invite card always sends email and password).
**Test intent:**
- No test: a type-only change; the storefront typecheck is the check.
**Done when:** no storefront reference to `customer_id` on this type; storefront lint clean and typecheck at or below baseline.
**Also update:** none found (no storefront test or doc mentions it).
