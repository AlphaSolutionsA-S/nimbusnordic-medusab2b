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
