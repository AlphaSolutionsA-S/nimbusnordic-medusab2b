# Plan: Order API matches size barcodes to the right Business Central item and size

**Key:** NIMBUS-180 · **Scope:** `scope.md` (approved 2026-10-23) · **Branch:** `feature/NIMBUS-180` from `develop`
**Apps:** backend only · **Tasks:** 4 · **Skills used:** `medusa-backend`, `medusa-infra-adapter`,
`medusa-workflow-and-steps`, `medusa-admin` (labels only), `secure-coding-owasp`

## 1. Summary [High]

When the order API passes an order to Business Central (BC), each line's barcode is today matched
only against the item-card barcode (`gtin`), and the BC line never names a size. Nimbus holds size
barcodes as Item Reference rows, so size lines are lost or sent without a size. This plan reads three
kinds of BC evidence per order in a few batched requests (items by item-card barcode, Item Reference
rows by barcode, items by number with their variants), decides each line with one pure rule, and
sends the resolved size on the BC line as `itemVariantId`.

Decisions that shape it:

- The decision moves out of the BC adapter. Today `findItemsForOrderLines` in the adapter decides the
  match; the adapter (L2) may not hold a domain rule, and the new rule is the product owner's. The
  adapter now only reads evidence; a pure L5 rule in `workflows/business-central-order/utils/`
  decides; the existing prepare step wires them.
- Reads are batched per order (chunks of barcodes or numbers joined with `or`), which is fewer BC
  requests than today's up to three per line. All call shapes were proven against TestDK by a
  read-only probe (`samples/bc-item-lookup-probe-planner.md`).
- The probe found that no TestDK item has an item-card barcode, and that the Metz sample barcodes are
  themselves size barcodes on items with sizes. The fix therefore applies to effectively every line,
  and the probe also exposed an existing defect: an item number longer than 20 characters (Metz's
  own SKUs, e.g. `NKT-NIM-TELLURIDENA-S`) makes BC answer 400, which today aborts the whole
  submission. The plan skips such values. See Needs your decision 1.

How to review this plan: this plan is the human review gate; approving it is what allows dispatch.
Section headings carry review levels (Critical, High, Medium); individual rows flagged `Critical`
are where review matters most: Needs your decision, and the state table in section 6. The data
model and state tables are rated High because past misses were found there. The task files hold more
depth for anyone who wants it but are not required reading. Uncertainties are often quicker to
resolve by asking the planning agent in chat than by reading further.

## 2. Needs your decision [Critical]

1. Item numbers longer than 20 characters are not sent to BC as filters (BC's item number is at most
   20 characters and rejects the whole request with 400); such a value counts as "no item". This
   fixes the existing whole-order abort found by the probe. *Default:* include it in this story.
2. A barcode that matches more than one item or size is refused as "Multiple items matched" without
   trying the item-number fallback (the scope's rule: the fallback applies only when the barcode
   matches nothing). Today an ambiguous barcode falls through to the item number, so one existing
   unit test changes. *Default:* refuse, as the scope rule reads.
3. That BC accepts `itemVariantId` when creating a sales order line and sets the line's variant is
   taken from Microsoft's API v2.0 documentation (property listed as editable) and the saved
   metadata; no write probe was run (planner probes are read-only). The after-deploy check proves it
   on a real line. *Default:* no pre-dispatch write probe; rely on the after-deploy check.
4. Unit codes are compared case-insensitively (BC stores codes upper-case; a customer may send
   `pcs`). *Default:* case-insensitive.

**Answers (Klaus Petersen, 2026-10-23):** all four defaults accepted; plan approved.

## 3. Flows [High]

### A. An order is submitted to BC (tasks 01, 02, 03)

1. The submission workflow's prepare step reads the order's canonical lines from order metadata, as
   today.
2. The step asks the BC adapter for the item lookup evidence of all lines in one call.
3. The adapter reads items whose item-card barcode equals any line barcode, in chunks of barcodes
   joined with `or`.
4. The adapter reads Item Reference rows (ODataV4 `ItemReferenceEntries`, with the company
   parameter) for the same barcodes, in chunks; each row carries barcode, item number, size code,
   unit and whether it is a "Bar Code" row.
5. The adapter reads items by number, with their sizes (`itemVariants` id and code) and base unit,
   for every item number named by those rows and by the lines' item number and customer item number,
   skipping blank values and values over 20 characters.
6. If any read fails or is throttled, the whole lookup fails and the submission is recorded as
   `bc_item_lookup_failed`, as today.
7. For each line, the step runs the barcode resolution rule on the line and the evidence; the result
   is either item + size (size may be none) or a refusal reason (section 6).
8. Refused lines become line failures with their reason; resolved lines become BC sales lines that
   carry `itemVariantId` when a size was resolved, and the customer's unit as today.
9. If no line resolved, the submission stops with `no_lines_resolved`, as today; otherwise the BC
   order is created and the line map `bc_lines` (customer line number, the customer's barcode, BC
   line number) is written as today.

### B. An Admin user looks at a refused line (task 02)

1. The Admin order widget reads the sanitized status, as today.
2. Line failures with the two new reasons show the labels "Size could not be determined" and
   "Barcode is for a different unit of measure".

## 4. What gets built [High]

### 01. Adapter reads the item lookup evidence

In the Business Central module (L2), a new evidence read per order is added beside the per-line item
lookup (which task 03 removes once the step no longer calls it). It returns three flat lists: items matched by item-card barcode, Item Reference rows for the
barcodes, and items matched by number. Every item now carries its sizes (variant id and code) and its
base unit. Item Reference rows are read through the existing ODataV4 URL helper; their type is decoded
to "bar code" or "other" (the blank type `" "`, Customer, Vendor), and empty unit and size codes stay
empty. Reads go in chunks of at most 20 values per `or` filter, every value is quote-escaped as today,
item numbers over 20 characters are skipped, and a response that is not complete (it carries a next
link) is never treated as complete. Any failed read throws an error whose message carries only the
status, so the existing step maps it to `bc_item_lookup_failed`. The BC sales line body gains
`itemVariantId`, sent only when set. The vendor reads and mapping go in a focused file beside
`service.ts`, exposed through the service (the module's `project.md`). No rule lives here: the
adapter neither filters by type or unit nor decides a match.

### 02. Barcode resolution rule and the two new line-failure reasons

A pure decision function (L5) takes one line (barcode, item number, customer item number, unit) and
the evidence, and returns item id + size id (or none) + how it matched, or a refusal reason. It
enforces every business rule in scope (section 6). The order-ingestion state contract gains two
line-failure reasons, `size_unresolved` and `unit_mismatch`, so they persist and parse; the Admin
order widget (Admin UI) gets their labels. The rule gets a row in the business-rule registry.

### 03. Submission uses the rule and sends the size

The prepare step (L3) calls the adapter's evidence read instead of the old lookup, keeps its failure
path (`bc_item_lookup_failed`), runs the rule per line, records refusals as line failures with the
customer's identifiers, and passes `itemVariantId` to the BC line. The line map and everything after
preparation are unchanged. The old adapter lookup and its tests are removed. HTTP integration tests that stubbed the old lookup are moved to the new
read and gain a size-barcode case.

### 04. Documentation

`docs/architecture/business-central-order.md` gains a section on how a line's item and size are
resolved (evidence, rule, reasons, request budget). The stale comment in the canonical order schema
that says nothing resolves from `itemNumber` is corrected. The business-rule registry row (task 02)
is checked against the final code.

## 5. Data model [High]

No tables, columns or migrations.

| Entity / field | Key and meaning | Existing callers | Owner | Written by | Stored or derived | Mutable until | Retention |
|---|---|---|---|---|---|---|---|
| BC Item Reference row | barcode → item number, size code, unit, type | none (new read) | BC | Nimbus staff in BC | read live per submission | — | BC's |
| BC item + `itemVariants` | item number → item id, base unit, sizes (code → id) | `items()` lookup in the adapter | BC | Nimbus staff in BC | read live | — | BC's |
| Item lookup evidence (in memory) | per order: three lists above | new | `businessCentral` adapter | prepare step | derived per run | — | none |
| Resolution result (in memory) | per line: item id, size id or none, matched by `eanNo` / `itemReference` / `itemNumber` / `custItemNo`, or a refusal reason | replaces `BCItemLookupResult` | rule (L5) | prepare step | derived | — | none |
| `BCCreateSalesOrderLineInput.itemVariantId` | BC variant GUID | `buildSalesOrderLineBody` | adapter | prepare step | sent to BC | — | — |
| `order.metadata.business_central_integration.line_failures[].reason` | gains `size_unresolved`, `unit_mismatch` | `bc-integration-state.ts`, `admin-bc-integration.ts`, widget | `orderIngestion` | outcome step (system or Admin retry) | stored | replaced on the next attempt | order lifetime |
| `...business_central_integration.bc_lines` | unchanged: `line_number`, `ean_no` (customer's barcode), `bc_sequence` | shipment notices | `orderIngestion` | outcome step | stored | replaced by an attempt that creates a BC order | order lifetime |

Cardinality: one barcode has 0..n Item Reference rows (TestDK: three per size barcode, two of type
"Bar Code"); one item has 0..n sizes; a line resolves to at most one item and one size.

## 6. Business rules as state tables [High]

Per order line. B = the line's barcode; G = items whose item-card barcode is B; R = "Bar Code" rows
for B (other types ignored); R' = the rows of R whose unit is empty, equals the line's unit, or (line
has no unit) equals the named item's base unit; "named item" = the item an evidence entry names.

| # | Evidence | Outcome (line) | Reason code | Side effect |
|---|---|---|---|---|
| 1 | G and R empty, no usable item number or customer item number | refused | `not_found` (`no_identifiers` only if every identifier is blank, as today) | line failure |
| 2 | R non-empty, R' empty, G empty | refused, no fallback | `unit_mismatch` | line failure |
| 3 | G ∪ R' name more than one item | refused, no fallback (`Critical`: changes today's fall-through, decision 2) | `ambiguous` | line failure |
| 4 | R' names more than one size code (an empty code counts as a value) | refused | `ambiguous` | line failure |
| 5 | one item; R' names size S; S is one of the item's sizes | item + S, matched by `itemReference` (also when G agrees on the item) | — | BC line with `itemVariantId` |
| 6 | one item; S not among the item's sizes | refused | `size_unresolved` | line failure |
| 7 | one item from G only, or R' with empty size; item has no sizes | item, no size, matched by `eanNo` / `itemReference` | — | BC line without size (today's Metz case) |
| 8 | as 7, but the item has sizes | refused | `size_unresolved` | line failure |
| 9 | R' names an item that the number read did not return | refused | `not_found` | line failure |
| 10 | G and R empty; item number, then customer item number (deduplicated, each at most 20 characters) names exactly one item without sizes | item, no size, matched by `itemNumber` / `custItemNo` | — | BC line |
| 11 | as 10, item has sizes | refused | `size_unresolved` | line failure |
| 12 | as 10, a number matches several items and none matches exactly one | refused | `ambiguous` | line failure |

Order-level, unchanged: any refused line leaves the others going ahead (`partial`); no resolved line →
`no_lines_resolved`, nothing sent; an evidence read failure → `bc_item_lookup_failed`, nothing sent,
retry from Admin. Actor: the system on the ingestion event, or the Admin user who starts a retry or
forced resend (unchanged); the customer is not told (scope).

## 7. Security-property matrix [High]

Not auth, personal or payment data; no new endpoint.

| Property | Control | Trust root | Failure behaviour | Negative test |
|---|---|---|---|---|
| A barcode or item number cannot change a BC filter | barcode: 13 digits at intake; item numbers: quotes doubled in every `or` filter, values over 20 characters never sent | canonical order schema; adapter escaping | 400 at intake; skipped value counts as no item | 01: an item number containing `'` and ` or ` is sent escaped as one literal; a 21-character number causes no request |
| No vendor text, company or customer data in logs or the Admin status | adapter errors carry the status only; refusals are reason codes; DTO drops unknown reasons | `bc-integration-state.ts`, `admin-bc-integration.ts` | unknown reason parses as `not_found`, unknown failure reason as null | 01: a failed read's error message has no response body; 02: unknown reason still parses |
| A size is never omitted for an item with sizes | rule rows 6, 8, 11 | rule (L5) | line refused | 02: rows 6, 8, 11 |

## 8. Decisions [New: High · From scope: Medium]

New in this plan:

- The match decision moves from the adapter to an L5 rule; the adapter only reads evidence. Why:
  layers.md L2 "hold a domain rule" is forbidden. Source: `ai/architecture/layers.md`.
- One evidence read per order, batched in chunks of 20 values per `or` filter (the module already
  chunks receipt-line filters at 20). Why: fewer requests than today, URL length bounded.
  `or` filters on both APIs: verified (probe rows 3, 4, 7).
- The adapter returns all Item Reference types decoded to "bar code" / "other"; the rule ignores
  "other". Why: the type rule is the product owner's and belongs in one home. Wire value `"Bar Code"`,
  blank `" "`: verified (probe row 5).
- Item numbers over 20 characters are skipped (decision 1). BC rejects them with 400: verified (probe
  row 9).
- Ambiguous barcode refuses without fallback (decision 2).
- A size code that BC's item does not list, or a size on an item without sizes, refuses as
  `size_unresolved` (rule row 6). Why: never send an unknown variant.
- Reason wire values `size_unresolved` and `unit_mismatch`; Admin labels "Size could not be
  determined", "Barcode is for a different unit of measure".
- New match source `itemReference` alongside `eanNo`, `itemNumber`, `custItemNo`.
- Unit comparison case-insensitive (decision 4).
- Does the framework already do this? BC's standard API v2.0 has no item reference entity (scoper,
  verified from metadata) and no barcode-to-variant lookup; Medusa has no part in it. The ODataV4 page
  is the only source. No framework internal is called.

From the scope (agreed): resolve to item + size; only "Bar Code" rows count; agreeing rows collapse;
unit rule and `unit_mismatch`; item-number fallback kept for items without sizes; never send an item
with sizes without its size; refusals shown in the Admin widget only; size on shipment notices is
NIMBUS-231.

## 9. Framework assumptions [Medium]

| Primitive | Verified behaviour | Evidence |
|---|---|---|
| ODataV4 `ItemReferenceEntries` via `getODataV4Url` (`?company='<name>'`) | 200; filter on `Reference_No`, `or` groups, `Reference_Type eq 'Bar Code'`; `$select` works; unknown barcode → `[]`; fields `Item_No`, `Variant_Code`, `Unit_of_Measure`, `Reference_Type`, `Reference_No` | verified, probe 2026-10-23 (`samples/bc-item-lookup-probe-planner.md` rows 1-6) |
| API v2.0 `items()` with `or` filter and `$expand=itemVariants($select=id,code)` | 200, every item with all its sizes | verified, probe row 7 |
| API v2.0 item `number` filter over 20 characters | 400 for the whole request | verified, probe row 9 |
| API v2.0 `salesOrderLine.itemVariantId` on POST | accepted and sets the variant | verified from Microsoft Learn (salesOrderLine resource, property not marked read-only) and saved metadata; write not exercised (decision 3) |
| Workflow failure shape | rejects with a serialised object | Tier 0 `medusa-boundary.md`; the step's existing try/catch is kept |

## 10. Open risks and gates [Medium]

| Risk | Owner | Blocking |
|---|---|---|
| Production BC data not probed (no item-card barcodes in TestDK; Klaus states production is set up the same) | Klaus | no |
| A truncated ODataV4 or API page (next link) on a very large order; handled by never treating it as complete (task 01), so at worst the submission fails and is retried | worker | no |
| `itemVariantId` write behaviour proven only after deploy (decision 3) | Klaus | no, unless decision 3 is answered otherwise |
