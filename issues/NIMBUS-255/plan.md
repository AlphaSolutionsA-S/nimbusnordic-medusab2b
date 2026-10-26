# Plan: Order detail shows the size of every item line

**Key:** NIMBUS-255 · **Scope:** `scope.md` · **Branch:** `feature/NIMBUS-255` (from `develop`)

## 1. Summary [High]

On the Business Central order detail page, invoiced item lines lose their size and repeat the
product name. The backend's order detail read already asks Business Central for the item variant
on open order lines but not on invoice lines. This plan adds the variant to the invoice read (same
request, no extra call), exposes it as a new optional order line field `variantCode` for both line
kinds, and has the storefront show it as its own "Size" field in the order lines table and the
return table, hiding the line description when it only repeats the product name or the size.

Shaping decisions: the size travels as a response field and is never parsed from text; the
"show the description only when it adds something" rule lives in one pure storefront helper used
by both tables; nothing is stored or written anywhere.

**How to review this plan.** This plan is the human review gate: approving it is what allows
dispatch. Section levels say how closely to read (Critical, High, Medium). There are no `Critical`
flags inside sections and nothing under "Needs your decision". The data model and state tables
are rated High because past misses were found there; here they are deliberately small. The task
files hold more depth but are not required reading. Questions are often quicker to settle by
asking the planning agent in chat than by reading further.

## 2. Needs your decision [Critical]

None. All scope questions were answered during scoping; the decisions new in this plan (section 8)
are low-risk display choices you may still overrule.

## 3. Flows [High]

### A. Customer opens a BC order detail page (tasks 01, 02)

1. The storefront requests the order detail from the backend for the order number in the URL.
2. The backend reads the open order (lines with item and item variant) and its invoices (lines with
   item and, new, item variant) from Business Central, in the same two requests as today.
3. The backend maps every line; an item line whose variant has a non-empty code gets `variantCode`
   set to that code, every other line has no `variantCode`.
4. The storefront renders each item line: product name once, the line description only when it
   differs from both the name and the size (trimmed, case-insensitive), and "Size: <code>" when the
   line has a `variantCode`. Comment and other non-item lines render as today.

### B. Customer starts a return from the same page (task 02)

1. The customer opens the return form (as today).
2. Each returnable item line shows the same name, description and size as in A4; the quantity
   field's accessible label names the product, not the size.
3. The return request still sends only line number, quantity and reason (unchanged).

## 4. What gets built [High]

### 01 Backend: variant code on BC order detail lines

The Business Central infra adapter's order detail read (L2) also expands the item variant on
invoice lines, alongside the item it already expands. The order line type gains an optional
`variantCode`; both the open order line mapper and the invoice line mapper fill it from the line's
item variant code, and leave it out when the line has no variant or an empty code. No other
mapping, request count or filtering changes; the store route (L6) passes the order through
unchanged and needs no edit.

### 02 Storefront: size field and description rule on order detail and return table

The storefront's copy of the order line type gains the same optional `variantCode`. A new pure
helper (S1) decides, for an item line, the name to show (display name, falling back as today to
description, item number), the extra description (only when present, not equal to the name and
not equal to the size, compared trimmed and case-insensitive) and the size (the variant code, or
none). The order detail template and the return table (S4) both use it: the item column shows the
name, the extra description if any, and the size as its own labelled value; the return quantity
field's accessible label uses the name. One new translation key for the size label goes into every
locale file under the shared return copy, and the business-rule registry gets a row for the
display rule.

## 5. Data model [High]

No stored data. One response field.

| Field | Meaning | Existing callers | Owner | Written by | Stored or derived | Encrypted | Mutable until | Retention | Indexes |
|---|---|---|---|---|---|---|---|---|---|
| `BCOrderLine.variantCode` (optional string; backend `modules/business-central/types.ts`, storefront `types/bc-order.ts`) | Business Central item variant code of the line, which is its size | none (new) | Business Central (source of truth) | BC; mapped by the backend's BC order detail read per request | derived per request | no | n/a (not stored) | none | none |

Cardinality: one variant per item line at most; absent on comment and non-item lines.

## 6. Business rules as state tables [High]

Display only; no state transitions, no writes, no actor recorded.

| Line | Condition | Shown | Side effects |
|---|---|---|---|
| Item, with variant code | always | name; "Size: <code>" | none |
| Item, no variant (or empty code) | always | name; no size field, no placeholder | none |
| Item | description equals name or size (trimmed, case-insensitive), or empty | description hidden | none |
| Item | any other description | description shown after the name | none |
| Comment | always | description, as today | none |
| Other non-item | always | description, as today | none |
| Return line (item) | same as the item rows above | same name, description, size | return request body unchanged |

## 7. Security-property matrix [High]

Not applicable: no auth, personal data, payment or regulated data changes. The order detail route
keeps its customer-number filter on both Business Central requests; `variantCode` is product data
read under that same filter.

## 8. Decisions [High / Medium]

**New in this plan**

- Field name `variantCode`, optional, omitted when absent: matches the existing reservation and
  return-line naming of the same BC value; optional rather than empty string so "no size" is
  unambiguous. (planner)
- The description rule is a pure storefront helper registered in `ai/architecture/decisions.md`,
  not backend logic: it is presentation of BC data, and one helper serves both tables. (planner;
  layers S1/S4)
- The return quantity field's accessible label uses the product name instead of the raw
  description (today it reads "M" on open lines). (planner; follows requirement 4)
- Size label key lives with the shared return copy (`Account.bcOrderReturn`) so both components use
  one key; locale texts: da Størrelse, de Größe, en Size, fr Taille, it Taglia, no Størrelse,
  pl Rozmiar, sv Storlek. (planner)
- Does the framework already do this? Not applicable: the data comes from Business Central, not a
  Medusa core flow; no framework internal is called. (planner)

**From the scope**

- Size is the variant code, not its description; every variant in use is a size (scope, rules).
- Description hidden when equal to name or size, trimmed and case-insensitive (scope, rules).
- Return table shows the size too; return request unchanged (scope, requirement 2).
- No extra Business Central call (scope, non-functional).

## 9. Framework assumptions [Medium]

| Primitive | Input | Output | Side effect | Status |
|---|---|---|---|---|
| BC API v2.0 `salesInvoices` with `$expand=salesInvoiceLines($expand=item,itemVariant)` | invoice filter as today | each line carries `itemVariant` with `code` ("XL" on SIN29817 line 20000), absent or null on lines without a variant | none (read-only) | verified: live read on TestDK 2026-10-26 (scope); production checked after deploy |
| BC API v2.0 `salesOrders` with `$expand=salesOrderLines($expand=item,itemVariant)` | unchanged | `itemVariant.code` per line ("M" on SO347954) | none | verified: in use today, TestDK read 2026-10-26 |

## 10. Open risks and gates [Medium]

- Production BC environment not yet read for invoice-line variants (owner: deployer; non-blocking;
  in "Verify after deploy" of task 01). Same API version as TestDK, so a 400 on the expand is not
  expected, but it would fail the whole order detail read.
- The "Size" key must be imported into the database-backed UI translations before the storefront
  release, or the page shows the key name (owner: release manager; non-blocking for dispatch).
