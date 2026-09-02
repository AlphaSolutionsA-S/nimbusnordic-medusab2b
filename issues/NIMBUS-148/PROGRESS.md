# Send the Medusa order to Business Central

- **Date:** 2026-09-02
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-148
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-148/
- **Updated by:** main session (see note below)
- **Outcome:** Scope approved; implementation planning is the next stage. As with NIMBUS-144/147/149,
  the user has not asked for the implementation-planner to be triggered yet — normal backlog pace.
- **Handover to:** implementation-planner agent (on request — not yet triggered)
- **Handover prompt:** Read `issues/NIMBUS-148/SCOPE.md` and plan the implementation for sending
  the persisted Medusa order (from NIMBUS-149) to Business Central. Scope is: (1) add a BC
  item-lookup method to the `business-central` module (`apps/backend/src/modules/business-central/`)
  resolving each canonical order line via `eanNo` first, falling back to `itemNumber`/`custItemNo`
  on failure or ambiguity; (2) add a real (non-stub) BC sales-order-creation method to the same
  module, following its existing OAuth2/OData conventions; (3) implement a `prepare-*`/`submit-*`
  workflow-step pair (matching the pattern in `workflows/business-central-return/`) that reads
  NIMBUS-149's raw canonical payload and BC integration-state metadata, resolves the BC customer
  via `Company.business_central_customer_number`, resolves each line's BC item, and submits the BC
  order with whatever lines resolve — partial resolution is allowed, not a hard failure; (4) on
  outcome, update NIMBUS-149's BC integration-state metadata object (BC order id, status
  `sent`/`failed`, timestamp, incremented retry count), and for partial resolution, record
  order-level and line-level failure detail in metadata (which line, why); (5) guard the reusable
  step against creating a duplicate BC order if invoked twice for the same Medusa order (exact
  mechanism open); (6) the trigger mechanism from NIMBUS-149 into this step is explicitly left open
  for the planner — do not assume the NIMBUS-144→147 convention applies here. Do NOT implement any
  admin UI, retry-trigger endpoint, or manual-retry flow — those belong to NIMBUS-158 (not yet
  scoped), which will later invoke this story's reusable submission step. Several implementation
  decisions are deliberately left open for the planner (see Open Questions in SCOPE.md): the exact
  BC sales-order-creation endpoint/payload shape, the exact BC item `$filter` for EAN lookup, the
  149→148 trigger mechanism, exact metadata field names for failure records, and the exact
  duplicate-submission guard. If SCOPE.md needs adjustment during planning, update it in place
  rather than creating a new scope document.

## Note on how this scope was produced

The scoper agent was launched as a background sub-agent to interview the user for this story (as
it had for NIMBUS-149 immediately prior). After its first round of questions was answered by the
user in the main session and relayed to it, the agent correctly refused to proceed: its own
instructions treat a coordinator relaying claimed user answers — rather than the user answering it
directly — as unverifiable, and it will not write scope on that basis. It also confirmed it has no
`AskUserQuestion`-equivalent tool available to it as a spawned sub-agent, so it could not open a
direct channel to the user itself, and stood by its refusal even when asked to seed such a tool's
options from the relayed answers.

This is a structural limitation of the sub-agent architecture (only the main session has a live
channel to the user), not a flaw in the user's actual answers, which were given directly to the
main session in this same conversation. Rather than attempt to route around the agent's safeguard,
the main session took over scoping directly: it reused all research the sub-agent had already
gathered (the existing `business-central` module, the `createReturnFromSalesOrder` stub pattern,
the `prepare-*`/`submit-*` workflow-step convention, the lack of any event bus or cron
infrastructure, and the real EDI line-shape sample), combined it with the user's direct answers to
the 9 open questions, and wrote `issues/NIMBUS-148/SCOPE.md` following the same structure and
level of detail as NIMBUS-144/147/149's scope documents. The user reviewed and approved the
resulting scope's summary before this file was written.
