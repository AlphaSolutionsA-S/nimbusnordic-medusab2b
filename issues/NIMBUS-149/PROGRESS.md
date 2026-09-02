# Create and persist the Medusa order

- **Date:** 2026-09-02
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-149
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-149/
- **Updated by:** scoper agent
- **Outcome:** Scope approved. Interviewed the user on the two genuinely open design questions
  from NIMBUS-147's prior scoping (line-detail retention mechanism, and shape of the "initial
  Business Central integration state"): (1) the complete raw canonical order JSON is persisted
  verbatim into a dedicated `metadata` key as the line-detail source of truth — not reshaped or
  re-derived — alongside mapped header fields as real Order columns; (2) a dedicated BC
  integration-state object (BC order id, status, timestamp(s), retry count) lives as a second,
  separate `metadata` key (not a separate data model), giving NIMBUS-148 and NIMBUS-158 a stable
  contract to build on. Confirmed: Medium priority, `develop` base branch, backend-only, normal
  backlog pace (same as NIMBUS-144/147). Confirmed constraint carried from NIMBUS-147: Medusa
  order created with header fields only, no `OrderLineItem` records. NIMBUS-149's Jira
  description was already in adequate Background/Goal/Scope shape at scoping time — no Jira
  update was needed. `issues/NIMBUS-149/SCOPE.md` written and approved as-is by the user.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Read `issues/NIMBUS-149/SCOPE.md` and plan the implementation for Medusa
  order creation/persistence from the validated canonical order NIMBUS-147 hands off. Scope is:
  (1) create a Medusa order with header fields only (map canonical fields — currency, contact
  email/phone, dates, addresses, company/customer reference — onto native Order columns where
  they fit, using NIMBUS-144's BC field-mapping table and NIMBUS-147's finalized canonical schema
  as inputs; exact field-by-field mapping is your decision); (2) create NO `OrderLineItem`
  records (Medusa has no product catalog behind these SKUs — confirmed constraint from
  NIMBUS-147); (3) persist the complete, verbatim canonical order JSON (including the full
  `lines` array) into a dedicated `metadata` key, stored as received, as the line-detail source
  of truth for NIMBUS-148 to consume later; (4) design and persist a BC integration-state object
  as a second, separate `metadata` key (not a separate data model) with a BC order id (initially
  null), a delivery status (initial "not yet sent"/pending value), timestamp(s), and a retry
  count (initial 0) — exact field names/types are your decision, but keep this key clearly
  separate from the raw-payload key; (5) associate the order with the company/customer context
  NIMBUS-147 resolves and hands off; (6) ensure order-creation failures are surfaced/recoverable,
  not silently dropped — exact mechanism (logging, error state, alerting) is your decision; (7)
  guard against double-creating an order if invoked more than once for the same validated order.
  Do NOT implement NIMBUS-147's validation/matching (assume it's already done and handed off), and
  do NOT implement NIMBUS-148's actual Business Central delivery/API call — this story only
  initializes the integration-state object that NIMBUS-148 will later update. If SCOPE.md needs
  adjustment during planning, update it in place rather than creating a new scope document.
