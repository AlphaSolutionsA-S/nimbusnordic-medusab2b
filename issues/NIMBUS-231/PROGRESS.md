# Progress

## 2026-10-23 — registered (follow-up of NIMBUS-180)

- Outcome: Klaus asked for the follow-up while approving the NIMBUS-180 scope. Story NIMBUS-231
  created (components `Customer Portal`, `Order API`), linked "relates to" NIMBUS-180; `feature.md`
  written from the NIMBUS-180 scope's "Out of scope" section.
- Proposed flow: full pipeline (order API contract change): `scoper`.
- Next owner: Klaus (go-ahead to start the `scoper`).
- Handover prompt: "Scope NIMBUS-231 from issues/NIMBUS-231/feature.md; first probe which BC field
  exposes the variant code on a posted shipment line."

## 2026-10-24 — scoped (scoper)

- Outcome: `scope.md` written (Story, full pipeline). Read-only TestDK probe recorded in
  `samples/bc-shipment-line-variant-testdk.md`: API v2.0 `salesShipmentLine` has no variant (400 on
  `itemVariantId`); the ODataV4 web service `TRCShipmentLine` (third-party extension) returns
  `variantCode` and joins the v2.0 lines on shipment number + line number. Found while scoping: both
  published schemas are closed, so customers validating against them would reject the new field;
  stored notices are served as stored, so old notices need a decision. Not recorded in Jira, not
  committed.
- Next owner: Klaus — answer the scope's open questions (priority, back-fill, schema-validating
  customers, field name, TRC dependency and production check, artifact home) and approve the scope.
- Handover prompt: "Revise issues/NIMBUS-231/scope.md with Klaus's answers, then record the
  approved scope in Jira per tracker-workflow § F." Planning needs a separate go-ahead.

## 2026-10-24 — scope revised with Klaus's answers (scoper)

- Outcome: `scope.md` updated: priority Must; field `variant_code`; no back-fill, old notices served
  with null and the cut-off documented (no production notices exist); new JSON Schema and XSD
  published with no opt-in or versioning, delivered in `issues/NIMBUS-231/artifacts/` and deployed
  by Klaus; `TRCShipmentLine` is the source (production verified by Klaus,
  `samples/bc-shipment-line-variant-production.md`); TRC extension ownership is a dependency risk.
  A second read-only TestDK run settled the remaining probe items (`samples/bc-shipment-line-variant-testdk.md`
  sections 5–6): undo corrections carry the variant of the line they undo; an or-filter over 20
  shipment numbers works in one request; BC pages at 20000 rows and emits next links, which the
  size read follows like the existing shipment reads. No open questions left. Not recorded in Jira,
  not committed.
- Next owner: Klaus — approve the scope.
- Handover prompt: "Record the approved NIMBUS-231 scope in Jira per tracker-workflow § F", then,
  on a separate go-ahead, "Plan NIMBUS-231 from issues/NIMBUS-231/scope.md" (`implementation-planner`).

## 2026-10-24 — scope approved

- Outcome: Klaus approved the scope and asked to plan. Jira comment added (rules, decisions, no
  open questions) and NIMBUS-231 moved to Estimation via "Scope approved".
- Next owner: `implementation-planner` (Klaus gave the go-ahead).
- Handover prompt: "Plan NIMBUS-231 from issues/NIMBUS-231/scope.md."
