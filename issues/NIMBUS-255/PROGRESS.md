# NIMBUS-255 progress

## 2026-10-26 — Triage

- Outcome: bug registered as NIMBUS-255 (Bug, component Customer Portal, status Scoping), linked
  "relates to" NIMBUS-170 and NIMBUS-137. Intake in `bug.md`.
- Route: full pipeline. It touches the Business Central integration (BC read and its mapped order
  contract between backend and storefront), which `ai/AGENTS.md` always routes to the full pipeline.
  Size of the change itself is small (two apps, a handful of files).
- Next owner: `scoper`, after the human's go-ahead.
- Handover prompt: "Scope NIMBUS-255 from `issues/NIMBUS-255/bug.md`. First confirm against live BC
  data (an invoiced order such as SO330301) that `salesInvoiceLines($expand=itemVariant)` returns the
  size as `itemVariant.code`, then decide how size and description are shown on order lines."
