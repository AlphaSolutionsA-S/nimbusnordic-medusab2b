# Define and validate the canonical order contract

- **Date:** 2026-09-01
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-147
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-147/
- **Updated by:** scoper agent
- **Outcome:** Scope approved; implementation planning is the next stage. User has asked to
  hold off running the implementation-planner for now — it will be triggered later by the
  user, not automatically.
- **Handover to:** implementation-planner agent (on request — not yet triggered)
- **Handover prompt:** Read `issues/NIMBUS-147/SCOPE.md` and plan the implementation for the
  canonical order contract. Scope is: (1) define the canonical JSON order contract as a
  two-tier model — native/core fields that are strictly typed/validated and map onto Medusa's
  native Order/OrderLineItem fields (customer/company reference via
  `business_central_customer_number`, currency, contact email, addresses, order lines), plus a
  nested `business_central` passthrough object for BC-only fields (dimension codes, salesperson,
  tax code, unit-of-measure, BC line-type, etc.) that is validated loosely and stored as-is in
  Medusa's native `metadata` jsonb rather than modeled as new columns; (2) define an XML
  representation that mirrors this canonical JSON model itself (not BC's raw OData XML), for
  NIMBUS-145's APIM `xml-to-json` policy to target; (3) implement customer/company matching by
  looking up the existing `Company.business_central_customer_number` field
  (`apps/backend/src/modules/company/models/company.ts`) — no new identifier field is needed,
  and NIMBUS-146 is assumed to already resolve the customer token to this value upstream; (4)
  implement canonical-level payload validation, distinct from and deeper than NIMBUS-144's
  structural/boundary validation; (5) implement duplicate-submission validation keyed on
  `externalDocumentNumber`, confirmed scoped per-company (same external order number from two
  different companies is NOT a duplicate) — this is the deep business-level check, separate
  from NIMBUS-144's shallow existence check. Several implementation-level decisions are
  deliberately left open for the planner: the exact field-by-field list and required/optional
  flags for the native vs. `business_central` tiers (use NIMBUS-144's BC field-mapping table as
  the starting point), and the exact error-response shape/status codes (follow NIMBUS-144's
  conventions). Do NOT implement Medusa order creation/persistence itself — that is NIMBUS-149.
  If SCOPE.md needs adjustment during planning, update it in place rather than creating a new
  scope document.

- **Date:** 2026-09-02
- **Updated by:** scoper agent
- **Outcome:** Canonical contract redesigned per user review. The two-tier "native/core vs.
  `business_central` passthrough" structure was rejected as leaking storage/implementation
  concerns into the contract shape. Replaced with a single, flat, domain-native schema — Order
  header (`externalOrderNumber` as the dedupe key, `customerNumber` for company matching,
  `orderDate`, `requestedDeliveryDate`, `currencyCode`, `salesperson`, `email`, `phoneNumber`,
  discount/tax/total fields, nested `billTo`/`shipTo` addresses, and a `lines` array) plus Order
  Line (`lineNumber`, `itemNumber`, `description`, `description2`, `unitOfMeasureCode`,
  `quantity`, `unitPrice`, discount/tax/amount fields, `requestedShipmentDate`). No
  `business_central` wrapper object, no native/passthrough labeling, and no two validation
  regimes — all fields validate as one schema. `issues/NIMBUS-147/SCOPE.md` and the NIMBUS-147
  Jira description were both updated to match. Which contract fields Medusa persists as real
  Order/OrderLineItem columns vs. stores in `metadata` is now explicitly reframed as NIMBUS-149's
  own internal implementation decision, not something this contract encodes. This redesign has
  not been re-approved beyond the story-level approval already given — it is presented back to
  the user for review before implementation planning proceeds.
- **Handover to:** user, for review of the redesigned schema (implementation-planner handover
  prompt above is now stale on the two-tier structure and should be re-read against the updated
  SCOPE.md, not treated as current, once the user confirms the redesign).

- **Date:** 2026-09-02
- **Updated by:** scoper agent
- **Outcome:** Contract corrected against real EDI sample files
  (`issues/NIMBUS-129/example edi files/order1.xml`, `order2.xml`, Evenex/N-EDI "ORDERS" format).
  All changes below were confirmed by the user before being applied. (1) `customerNumber` removed
  from the canonical JSON body entirely — the customer identifier now arrives at NIMBUS-144's
  endpoint as a query-string parameter (NIMBUS-144 is being reopened separately to reflect this)
  and is passed through the async hand-off for this story's company-matching to consume; the
  matching logic itself (against `Company.business_central_customer_number`) is unchanged, only
  the value's transport changed. (2) `billTo`/`shipTo` made optional — Business Central holds
  default ship-to/bill-to master data, and this story's job is only to not reject a payload that
  omits them (resolving the BC fallback is downstream enrichment, not this story's job). (3) All
  computed total fields dropped entirely from the input contract (header:
  `totalAmountExcludingTax`/`totalTaxAmount`/`totalAmountIncludingTax`; line:
  `amountExcludingTax`/`totalTaxAmount`/`amountIncludingTax`) — neither sample file includes any
  total field, only calculation inputs. (4) Added `eanNo` to Order Line as the reliable item
  identifier (present on every line in both samples), alongside `itemNumber` and an optional
  `custItemNo` pass-through hint. (5) Recorded a major architectural constraint: Medusa has no
  product catalog behind these items, so NIMBUS-149 will persist Medusa order **header fields
  only** and create **no `OrderLineItem` records**; the canonical `lines` array passes through
  (mechanism TBD, likely `metadata`) for NIMBUS-148 (not yet scoped) to consume, and the
  EAN → BC-item-number lookup belongs to that future NIMBUS-148 line-creation workflow, not to
  147 or 149. Also added a "Findings from Real EDI Samples" section flagging two open items:
  the real customer identifier in the samples is a 13-digit EAN-format number (BC team to confirm
  `Company.business_central_customer_number` stores EAN-format values for EDI customers), and
  `UnitPrice` uses comma-decimal formatting that needs normalizing (likely NIMBUS-145's concern).
  `issues/NIMBUS-147/SCOPE.md` and the NIMBUS-147 Jira description were both updated to match.
  User confirmed all of these changes before they were applied — no separate approval gate for
  applying them, but the resulting schema is presented back to the user for awareness.
- **Handover to:** user, for awareness of the corrected schema (implementation-planner handover
  prompt from the previous entry is now doubly stale — both the two-tier structure and this
  round's field-level corrections need to be re-read against the current SCOPE.md before planning
  starts).
