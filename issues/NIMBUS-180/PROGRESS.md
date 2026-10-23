# NIMBUS-180 progress

## 2026-10-19 — Registered (triage)

- Outcome: bug registered in Jira (NIMBUS-180, components Customer Portal and Order API, linked
  "relates to" NIMBUS-129 and NIMBUS-130); `bug.md` written. Suspected from code reading and the Metz
  DESADV sample; not reproduced, Business Central not called.
- Proposed route: full pipeline (order API and Business Central sync always go through it):
  `scoper` first. Not started; awaiting the human's go-ahead.
- Next owner: human (decide whether to start the `scoper`).
- Handover prompt: "Scope NIMBUS-180 from `issues/NIMBUS-180/bug.md`: resolve variant EANs on order
  API lines to BC item + variant and send the variant code on the sales line; settle the open
  questions in bug.md first (PO decision, where BC holds variant EANs, BC behaviour without a variant
  code)."
- Not committed yet: commit the case folder (with `issues/NIMBUS-130/samples/`, which bug.md cites).

## 2026-10-23 — Scope drafted (scoper)

- Outcome: `scope.md` written (Bug, Medium, backend only, full pipeline). Verified from saved
  metadata: v2.0 `salesOrderLine` takes `itemVariantId` (no `variantCode`); v2.0 has no item
  reference entity; the ODataV4 metadata publishes `ItemReferenceEntries` (item, variant, unit,
  reference type, barcode). UNVERIFIED: whether Henderson's size barcodes are stored there, and what
  BC does with a variant-less line for a variant item (probes listed in the scope).
- Not recorded in Jira: scope not approved yet. Nothing committed.
- Next owner: Klaus — answer open questions 1-9 in `scope.md` (at least 1, and run or authorise the
  probes in 2, 3, 5), then approve the scope.
- Handover prompt: "Revise the NIMBUS-180 scope with Klaus's answers to the open questions, then
  record 'scope approved' in Jira once he approves."

## 2026-10-23 — Scope revised with Klaus's answers (scoper)

- Outcome: `scope.md` revised.
  - Product-owner rule: a barcode always points to one item and size, so a line resolves to
    item + variant.
  - Per-size barcodes are held in Item Reference (`ItemReferenceEntries`). TestDK was checked by
    query (`samples/bc-variant-barcodes-testdk.md`); for production, Klaus stated it is the same
    (not queried).
  - Item Reference rows that agree on item + variant collapse into one match; only rows that
    disagree are refused.
  - A line for an item with sizes is never sent without its size, so BC's handling of a size-less
    line was not probed and is no longer needed.
  - Klaus's manual ODataV4 query failed with a hand-written `company` parameter; recorded as a
    note, no design change.
- Open questions now 1-6: reference types, unit of measure, item-number fallback,
  priority/history, customer feedback, shipment-notice size code.
- Not recorded in Jira; nothing committed.
- Next owner: Klaus. Answer or accept the proposals in open questions 1-6, then approve the scope.
- Handover prompt: "Finalise the NIMBUS-180 scope with Klaus's answers to open questions 1-6 and
  record 'scope approved' in Jira once he approves."

## 2026-10-23 — Scope final, open questions answered (scoper)

- Outcome: `scope.md` updated with Klaus's answers.
  - Only "Bar Code" reference rows count.
  - A barcode held only for another unit of measure is refused with its own line-failure reason.
  - The item-number fallback is kept for items without sizes.
  - No order-API orders are in production yet, so there is no history to correct.
  - Showing refused lines in the Admin widget only is accepted.
  - Size code on shipment notices: out of scope, a follow-up to be registered (described under
    "Out of scope" in `scope.md`).
- No open questions remain.
- Not recorded in Jira; nothing committed.
- Next owner: Klaus. Approve the scope. Separately: register the shipment-notice size follow-up.
- Handover prompt: "Record 'scope approved' for NIMBUS-180 in Jira, then, on a separate go-ahead,
  hand `issues/NIMBUS-180/` to implementation-planner."

## 2026-10-23 — scope approved

- Outcome: Klaus approved the scope. Jira comment added (rules, decisions, no open questions) and
  NIMBUS-180 moved to Estimation via "Scope approved". Follow-up registered as NIMBUS-231 ("Show
  the size on shipment notice lines", linked "relates to"; case folder `issues/NIMBUS-231/`).
- Next owner: `implementation-planner` (Klaus gave the go-ahead to plan).
- Handover prompt: "Plan NIMBUS-180 from issues/NIMBUS-180/scope.md."
