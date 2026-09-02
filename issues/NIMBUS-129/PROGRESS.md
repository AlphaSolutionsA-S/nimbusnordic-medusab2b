# Receive Orders Through JSON and XML

- **Date:** 2026-08-21
- **Type:** Epic
- **Tracker:** JIRA - https://alphasolutionsdk.atlassian.net/browse/NIMBUS-129
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-129/
- **Updated by:** scoper agent
- **Outcome:** Scope approved; Jira epic and stories NIMBUS-144 through NIMBUS-149 were aligned, and NIMBUS-158 was created for the Medusa Admin status-and-retry widget. Implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Plan NIMBUS-129 from the approved scope in issues/NIMBUS-129/SCOPE.md. Update the existing scope only if planning uncovers a required clarification, produce the implementation plan and task manifest for the Medusa backend/admin and Azure APIM/Logic App work, and preserve the approved story boundaries for NIMBUS-144 through NIMBUS-149 and NIMBUS-158.

- **Date:** 2026-08-21
- **Updated by:** scoper agent
- **Outcome:** Scope clarification approved: NIMBUS-147 defines an XML representation compatible with Azure API Management's `xml-to-json` policy, and NIMBUS-145 uses that policy for the actual XML-to-canonical-JSON transformation (https://learn.microsoft.com/en-us/azure/api-management/xml-to-json-policy).
- **Handover to:** implementation-planner agent
- **Handover prompt:** Plan NIMBUS-129 from the approved scope in issues/NIMBUS-129/SCOPE.md, treating the Azure API Management `xml-to-json` policy as the required XML transformation facility for NIMBUS-145 and ensuring the NIMBUS-147 contract is compatible with it.

- **Date:** 2026-09-02
- **Updated by:** orchestrating assistant (epic-wide consistency check after NIMBUS-144/147 rework)
- **Outcome:** Reviewing real EDI sample files against the approved NIMBUS-144/147 designs
  surfaced that Medusa has no product catalog behind these order items, so NIMBUS-149's Medusa
  order is now header-only (no `OrderLineItem` records) — canonical line data passes through
  for NIMBUS-148's Business Central order-line creation instead. This epic's Proposed Structure
  (item 6) was corrected to match. NIMBUS-149's Jira description ("Medusa order with its order
  lines") was also corrected. Notes for NIMBUS-148 (owns EAN→item lookup and BC line building,
  not just "send the order"), NIMBUS-158 (its widget needs to surface the retained canonical
  line data since the Medusa order page will show no native line items), and NIMBUS-146 (minor
  ownership wording — matching is NIMBUS-147's job, not "when the order is created") were added
  as Jira comments for persistence, pending those stories' own scoping.
  **Resolved 2026-09-02:** the epic and NIMBUS-148 both described returning the Business
  Central order identifier synchronously to the caller ("Return the Business Central identifier
  on success"), but the approved NIMBUS-144 design returns 201 + a Medusa order reference
  immediately, with BC delivery happening asynchronously afterward. User confirmed: keep the
  async design as-is — the calling system never receives the Business Central order identifier,
  at any point, by any mechanism. It is retained internally and surfaced only to internal
  operations via NIMBUS-158's admin widget. No callback/webhook/polling mechanism to the
  external system is needed. Epic SCOPE.md, the epic's Jira description, and NIMBUS-148's Jira
  description were corrected to match.
- **Handover to:** implementation-planner agent, once the user is ready to plan NIMBUS-144
  and/or NIMBUS-147 (146/148/149/158 remain unscoped locally, with corrective Jira comments/
  description fixes in place for when they are scoped).
