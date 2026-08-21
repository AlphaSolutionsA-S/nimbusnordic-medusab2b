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
