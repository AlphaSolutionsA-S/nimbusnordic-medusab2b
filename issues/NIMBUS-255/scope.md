# Order detail: size is missing on invoiced order lines

**Date:** 2026-10-26
**Status:** Scoped (approved 2026-10-26)
**Type:** Bug
**Priority:** Medium
**Issue:** NIMBUS-255
**Key:** NIMBUS-255
**Case folder:** issues/NIMBUS-255/
**Base Branch:** develop (work branch `feature/NIMBUS-255`)

## Background

On the Business Central order detail page in the customer portal, the item lines of an invoiced
order show no size and repeat the product name (SO330301: "Franklin Unisex - Grey Melange Franklin
Unisex - Grey Melange"). On open orders the size shows only because Business Central happens to
put it in the line's description text (SO347954: "Camden Men - Midnight Blue M"). Customers buy
the same product in several sizes, so a line without its size cannot be told apart.

What Business Central actually returns (read from the TestDK environment on 2026-10-26, read-only):

| Order | Source | Item name | Line description | Variant code (size) |
|---|---|---|---|---|
| SO330301 | invoice SIN29817 line 20000 | Franklin Unisex - Grey Melange | Franklin Unisex - Grey Melange | XL |
| SO347954 | open order line 20000 | Camden Men - Midnight Blue | M | M |

So:
- Invoice lines do carry the size: asking Business Central for the line's item variant returns its
  code ("XL"). The portal does not ask for it today, so the size is lost.
- On invoice lines the description is the product name again, which causes the duplicate.
- On open order lines the description is the size itself ("M"), not a free text; the page joins
  name and description, which is why "Camden Men - Midnight Blue M" looks right today.
- Comment lines (e.g. "Shopify-ordrenr.: DK4750") have no item and no variant.

## Requirements

### Functional

1. Every item line on the BC order detail page shows its size as its own labelled field ("Size",
   a new translation key), for open order lines and invoice lines alike, taken from the line's
   Business Central item variant code (not the variant description). Every variant in use is a
   size, so the label "Size" always applies.
2. The return table on the same page shows the same size field on each of its lines, so the
   customer can tell which line they are returning.
3. An item line without a variant shows no size field (no empty label, no placeholder).
4. The product name is shown once. The Business Central line description is shown in addition only
   when it adds something: not when it equals the product name, and not when it equals the size
   (both compared trimmed and case-insensitive).
5. Comment lines and other non-item lines are shown as today.
6. The size reaches the storefront as a field of the order line in the backend's order detail
   response; the storefront does not parse it out of the description.

### Non-functional

- The order detail read makes no extra calls to Business Central: the variant is requested in the
  invoice read the page already makes, as the open order read already does.
- The new label is a translation key in every locale file, imported into the database-backed UI
  translations before the storefront is released (runtime text comes from the database).
- The return request is unchanged: it still identifies lines by line number; the new field is
  display-only.

## Business rules

- Item line with a Business Central item variant → its size is the variant code, shown as "Size: <code>".
- Item line without an item variant → no size shown.
- Line description equal to the product name or to the size (compared trimmed, case-insensitive)
  → not shown; any other description → shown after the product name.
- Open order lines and invoice lines follow the same display rules, in the order lines table and
  in the return table.
- Read-only: nothing is written to Business Central or to the portal's database.

## Data model (draft)

No stored data changes. One field is added to the order line of the BC order detail response
(backend type and the storefront's copy of it).

| Field | Meaning | Owner | Written by | Stored or derived | Sensitive | Retention |
|---|---|---|---|---|---|---|
| order line size field (name ?, e.g. `variantCode`) | Business Central item variant code of the line, which is the size | Business Central (source of truth) | Business Central; mapped by the backend's BC order read | derived per request, not stored | no | none (not stored) |

## Security properties (draft)

Not applicable: no auth, personal data, payment or regulated data changes. The order detail route
keeps its existing customer-number filter; the new field is product data.

## Affected apps

- Backend (`apps/backend`): Business Central order detail read and its line type.
- Storefront (`apps/storefront`): order line type, BC order detail page and its return table,
  translation files.

## Proposed structure

A small bug fix, likely two tasks:

1. Backend: request the item variant on invoice lines; add the size field to the order line and
   fill it from both open order lines and invoice lines; update the order detail tests.
2. Storefront: add the field to the order line type; render the size as its own labelled field and
   apply the description rule, in the order lines table and the return table; add the translation
   key to every locale file; update the order detail page and return table tests.

Also update (for the planner to confirm): `apps/backend/src/modules/business-central/__tests__/service.spec.ts`
(order detail expectations), `apps/storefront/src/__tests__/modules/account/templates/bc-order-detail-template.test.tsx`,
`apps/storefront/src/__tests__/modules/account/components/bc-order-return/index.test.tsx`;
no `docs/architecture/` section describes order detail lines (`business-central-order.md` covers
order submission only).

Not yet verified after deploy: the production Business Central environment returns the same
variant on invoice lines (verified on TestDK only), and the label appears translated in each locale
once the keys are imported.

## Open questions

None. Production Business Central behaviour is a deploy-time check (Dependencies), not a decision.

## Dependencies

- Business Central API v2.0 `salesInvoiceLines` with `itemVariant` expansion: verified on TestDK
  (SO330301 → `itemVariant.code` "XL"); production environment UNVERIFIED.
- UI translation import through the Admin before the storefront release.
- Related: NIMBUS-170 (BC sales orders and invoices merged in order history), NIMBUS-137 (order
  detail).
