# Make company information read-only in the storefront

- **Date:** 2026-08-21
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-157
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-157/
- **Updated by:** feature skill
- **Outcome:** Feature captured; scoping is the next stage.
- **Handover to:** scoper agent
- **Handover prompt:** Scope the feature in
  `issues/NIMBUS-157`. Interview the requester
  interactively before writing `SCOPE.md`. Determine which storefront company pages and fields
  are affected, how existing edit actions should change, the placement and wording of the
  backend company-view notice, and whether Business Central-managed fields need individual
  visual identification. Preserve the requirement that all storefront company information is
  read-only and that the backend notice explains Business Central-managed values are
  overwritten on customer login while Medusa-only values are preserved. Align with NIMBUS-156
  without expanding that story's synchronization field mapping.

## 2026-08-21 - Scoping completed

- **Date:** 2026-08-21
- **Updated by:** scoper agent
- **Outcome:** Scope approved; implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Please plan NIMBUS-157 from the approved scope in
  `issues/NIMBUS-157/SCOPE.md`. Read `FEATURE.md` and this progress record for context.
  Produce the implementation plan and task manifest without implementing production code.
  Preserve the read-only storefront profile, server-enforced company-admin-only financial
  fields, complete company-information display, persistent Admin warning, per-field Business
  Central indicators, Admin editability, and dependency on NIMBUS-156.

## 2026-09-16 - Implementation planning completed

- **Date:** 2026-09-16
- **Updated by:** implementation planner
- **Outcome:** Created \`PLAN.md\`, a dispatch-ready \`manifest.md\`, and four dependency-ordered
  implementation task files. The plan uses NIMBUS-156's implemented company-sync contract and
  treats its Internal review status as an acceptable dependency state.
- **Handover to:** implementor agent
- **Handover prompt:** Implement NIMBUS-157 from \`issues/NIMBUS-157/manifest.md\` in dispatch
  order. Begin with Task 01's server-side ownership and financial-field projection; do not rely
  on UI hiding. Task 03 may run independently. Complete Task 04's tests and record verification
  outcomes here before requesting review.
