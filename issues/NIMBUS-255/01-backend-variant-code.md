# 01: Backend: variant code on BC order detail lines
**App:** backend · **Layer:** L2 infra adapter (`businessCentral`) · **Depends on:** None

**Goal:** The BC order detail read expands the item variant on invoice lines too, and every order line carries the variant code as `variantCode` when it has one.
**Files / areas:** `apps/backend/src/modules/business-central/service.ts` (`getOrder`, invoice line raw type, both line mappers), `apps/backend/src/modules/business-central/types.ts` (`BCOrderLine`).
**Seam contracts:** `GET /store/bc-orders/:id` response `order.lines[].variantCode?: string`, present only when the BC line's `itemVariant.code` is a non-empty string; absent otherwise. No other response field changes.
**Test intent:** (unit, `service.spec.ts`, existing `getOrder` fetch mocks)
- Invoice request `$expand` is `salesInvoiceLines($expand=item,itemVariant)`; order request unchanged; no additional BC request is made.
- Open order line with `itemVariant.code` "L" → `variantCode` "L"; invoice line with `itemVariant.code` "XL" → `variantCode` "XL" (both the open-plus-invoiced and the invoice-only path).
- Line with `itemVariant` null, missing, or code "" → no `variantCode` key.
- Comment line → no `variantCode`; description, quantities and reservations mapping unchanged.
**Done when:** the tests above pass; lint and typecheck at or below baseline.
**Verify after deploy:** `GET /store/bc-orders/SO330301` as a customer of that company: `order.lines[]` line 20000 from invoice SIN29817 has `variantCode` "XL" (production BC; TestDK already confirmed).
**Also update:** `apps/backend/src/modules/business-central/__tests__/service.spec.ts` (order detail expectations and the `$expand` assertion); no `docs/architecture/` section covers order detail lines; no contract test exists for `/store/bc-orders/:id`.

## Deviations

- Test command: `service.spec.ts` is not a `*.unit.spec.ts` file, so the manifest's `test:unit` finds no tests; it runs under `pnpm --filter @b2b-starter/backend test:integration:modules -- src/modules/business-central/__tests__/service.spec.ts` (fetch mocks only, no database).
- Test cases: the "no extra BC request" clause is asserted as exactly five fetch calls (token, customer, order, invoices, reservations), one each to `salesOrders()` and `salesInvoices()`. The absent-`variantCode` cases (null, missing, "", comment) pass before the change by nature; they guard the implementation against emitting an empty or undefined key.
- The existing `$expand` assertion (order request) needed no change; the invoice `$expand` assertion was added in the new tests instead.
- Pre-existing failure, not caused here: `listOrders › stops filling from salesInvoices after the round-trip guardrail even if the page stays short` fails on the unchanged code too (the BC module test in the `verification.md` baseline).

## Done-when evidence

- Invoice `$expand` is `salesInvoiceLines($expand=item,itemVariant)`, order unchanged, no extra request: `service.spec.ts` › getOrder › variant code on order lines › "expands the item variant on invoice lines in the existing requests, with no extra request".
- Open line "L" and invoice line "XL", open-plus-invoiced path: same block › "sets variantCode on open and invoiced item lines that have a variant code".
- Invoice line "XL", invoice-only path (and its null/"" lines without the key): same block › "sets variantCode on invoice lines of a fully invoiced order".
- `itemVariant` null, missing, "" and comment lines carry no `variantCode` key: same block › "leaves variantCode out of line %s" (7 cases, both paths' mappers).
- Comment line and item line mapping otherwise unchanged: same block › "keeps the rest of each line's mapping unchanged" (full `toEqual`); existing reservation and returnable-quantity tests still pass.
- Lint: `pnpm --filter @b2b-starter/backend lint`, 0 errors (13 pre-existing warnings, none in touched files).
- Typecheck: `apps/backend/node_modules/.bin/tsc --noEmit`, 22 errors (baseline 22), none in touched files.
- Also update `service.spec.ts`: new `variant code on order lines` block with the invoice `$expand` assertion and line expectations; existing order `$expand` assertion unchanged (still correct). No `docs/architecture/` section or contract test to update (none exists, per the task).
