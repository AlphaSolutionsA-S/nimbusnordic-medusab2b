# Deviation report: Order detail shows the size of every item line

Branch `feature/NIMBUS-255`, merge-base `0e0231c`, tasks 01 (NIMBUS-256, `d22c39c`) and 02
(NIMBUS-257, `03b83e9`). Reviewed 2026-10-26.

## Deviations from scope and plan

- **BLOCKING (needs your decision): `pnpm ai:check` fails on the branch.** The new
  `ai/architecture/decisions.md` row makes the generated root `AGENTS.md` 32891 bytes, over the
  32768-byte limit (HEAD was 32749, 19 bytes of headroom). The row is already as short as it can
  usefully be. See open question 1.
- Task 01: the BC service tests live in `service.spec.ts`, which runs under
  `test:integration:modules` (no database), not `test:unit` as the manifest said. Acceptable: a
  test-command correction only.
- Task 01: "no extra BC request" is asserted as exactly five fetch calls with one each to
  `salesOrders()` and `salesInvoices()`. Acceptable; stronger than the intent.
- Task 01: the absent-`variantCode` cases (null, missing, "", comment line) pass on the old code by
  nature; they guard against emitting an empty or `undefined` key. Acceptable.
- Task 02: helper also treats a whitespace-only variant code as no size and trims shown names and
  descriptions. Acceptable: same trim the plan's comparison uses.
- Task 02: non-item, non-comment lines keep today's text without a size (helper applied to item
  lines only, per the plan's state table). Acceptable; output unchanged for those lines.
- Task 02: size shown as "Size: XL" on its own line under the name in the existing item column, not
  as a new table column. Acceptable: matches "its own labelled value".
- Task 02: one extra return-table case (a description that differs from name and size is shown).
  Acceptable.

## Consolidation changes

None. The display rule has one home (`getBcOrderLineDisplay`,
`apps/storefront/src/lib/util/bc-order-line-display.ts`) used by both components; the backend's
private `variantCodeOf` helper is shared by both line mappers; `BCOrderLine.variantCode` exists in
both the backend and storefront types per the documented type split (`decisions.md`, last line).
The 9-line name/description/size JSX cell is duplicated in `bc-order-detail-template.tsx` and
`bc-order-return/index.tsx`; left as is, since the rule itself is in one place.

## Findings

Design against the plan:

- Data model (one response field, nothing stored): `variantCode` is written only by the BC
  adapter's two mappers (`apps/backend/src/modules/business-central/service.ts:500-503`, spread at
  526 and 545), omitted when the code is missing or empty, as planned. The store route passes it
  through unchanged. Storefront type matches (`apps/storefront/src/types/bc-order.ts:35`).
- State table: item lines with and without a variant, description hidden when equal to name or
  size (trimmed, case-insensitive), comment and other lines unchanged, return request body
  unchanged: all hold in the code and each row has a test.
- Security matrix: not applicable. Both BC requests keep their customer filter; only the invoice
  `$expand` changed (`service.ts:2451`).
- Framework assumptions: the invoice `itemVariant` expand is verified on TestDK only; production is
  in "Verify after deploy" (plan section 10). If production rejects the expand, the whole order
  detail read fails, not just the size.
- Business rules: one new rule, one home, registered in `decisions.md` (but see open question 1).
  No second implementation found.

Low, non-blocking:

- `bc-order-detail-template.tsx` and `bc-order-return/index.tsx`: the ": " between the size label
  and the code is hard-coded in JSX (`{t("sizeLabel")}: {display.size}`). It passes
  `react/jsx-no-literals`, but locales cannot change it (French typography is "Taille : XL"). An
  ICU message such as `"sizeLabel": "Size: {size}"` would fix it. See open question 2.

Mechanical wiring: no issues.

- New exports (`getBcOrderLineDisplay`, `BcOrderLineDisplay`) are both imported; no dead exports.
  Imports use the `@/` alias and resolve. No casts added.
- Cross-app: the backend's `variantCode` and the storefront type agree; no other consumer of
  `BCOrderLine` shows line text (`bc-order-line-fulfillment` reads no description or item number).
  No hard-coded URLs, no new routes or pages.
- New UI text is the translation key `Account.bcOrderReturn.sizeLabel`, present in all 8
  `messages/*.json` files.
- Comments cite the issue key only; no plan or task ids.
- `git status`: only the unrelated `issues/NIMBUS-236/PROGRESS.md`; nothing from this branch is
  uncommitted (this report aside).
- "Also update": both component tests and `service.spec.ts` updated; no `docs/architecture/`
  section or contract test covers BC order detail lines; `decisions.md` row added. Nothing stale.

## Tests

- No security-critical path changed; the order detail route's customer filter is untouched.
- Test lines vs source lines added: about 466 vs 69 (excluding locale JSON), ratio about 6.8. The
  backend's seven parametrized "no `variantCode`" cases and the template/return-table cases overlap
  the helper's unit tests somewhat, but each asserts at its own layer (mapper output, rendered
  text, submitted body); not redundant enough to trim.
- Finalization: backend unit 1016 pass; backend module integration 584 pass, 2 fail (the same
  baseline BC `listOrders` guardrail test, src and compiled copy); storefront 611 pass; typecheck
  at baseline (backend 22, storefront 8); both builds succeed. `test:integration:http` not run (no
  HTTP test touched; 77 baseline failures, NIMBUS-236).

## Open questions

1. **`pnpm ai:check` fails (blocking).** Generated `AGENTS.md` is 123 bytes over the limit because
   of the new `decisions.md` row. Options:
   a. Keep the row and trim at least 123 bytes elsewhere in Tier 0 (`ai/architecture/*.md`), e.g.
      shorten the shipment-notice row in `decisions.md`, then `pnpm ai:check --fix`.
   b. Drop the row; the rule then lives only in the helper and its tests, unregistered.
   c. Raise or restructure the size limit in the harness (affects every tool reading `AGENTS.md`;
      a harness change, not this branch's).
2. **Size separator (non-blocking).** Keep the hard-coded "Size: XL" format, or move the colon
   into an ICU message (`"Size: {size}"`) in all 8 locales so French can use "Taille : XL"? The
   latter is a small fix on this branch; the former can ship as is.

## Verify after deploy

- 01 Backend: variant code on BC order detail lines — `GET /store/bc-orders/SO330301` as a customer
  of that company: `order.lines[]` line 20000 from invoice SIN29817 has `variantCode` "XL"
  (production BC; TestDK already confirmed).
- 02 Storefront: size field and description rule on order detail and return table — storefront
  page for SO330301 shows "Franklin Unisex - Grey Melange" once with "Size: XL"; SO347954 shows
  "Camden Men - Midnight Blue" with "Size: M"; the size key is present in the database-backed UI
  translations for each active locale (Admin Translations page).
